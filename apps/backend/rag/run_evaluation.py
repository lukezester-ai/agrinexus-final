import json
import os
import asyncio
from datasets import Dataset
from ragas import evaluate
try:
    from ragas.metrics import (
        faithfulness,
        answer_relevancy,
        context_precision,
        context_recall,
    )
except ImportError:
    from ragas.metrics.collections import (
        faithfulness,
        answer_relevancy,
        context_precision,
        context_recall,
    )

# Импортираме директно LLM-а, за да избегнем бъга в Python 3.14 с Langchain/Pydantic
from core.llm import llm
from langchain_core.messages import HumanMessage

def run_rag(question: str):
    """
    Симулация на RAG пайплайн.
    Връща генерирания отговор и използвания контекст (документи).
    """
    # 1. Задаваме въпроса директно на LLM-а (bypassing retriever заради Python 3.14 issue)
    prompt = f"Отговори като експерт агроном на въпроса: {question}"
    answer = llm.invoke([HumanMessage(content=prompt)]).content
    
    # 2. Фиктивен контекст за нуждите на теста
    contexts = [f"Земеделска справка за: {question}"]
    
    return answer, contexts

def evaluate_dataset(json_path: str, max_samples: int = 3):
    """
    Зарежда въпросите, прекарва ги през RAG-а и ги оценява с RAGAS.
    max_samples: ограничение за броя въпроси, за да не изхабим прекалено много API токени при тест.
    """
    print(f"📥 Зареждане на дейтасет: {json_path}")
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    test_data = data[:max_samples]
    
    questions = []
    answers = []
    contexts_list = []
    ground_truths = []
    
    print(f"🤖 Генериране на отговори за {len(test_data)} въпроса през AgriNexus Tutor...")
    for idx, item in enumerate(test_data):
        q = item["question"]
        print(f"  [{idx+1}/{len(test_data)}] Въпрос: {q}")
        
        ans, ctx = run_rag(q)
        
        questions.append(q)
        answers.append(ans)
        contexts_list.append(ctx)
        ground_truths.append(item["ground_truth"])
        
    # Създаваме HuggingFace Dataset обект (задължителен формат за RAGAS)
    dataset_dict = {
        "question": questions,
        "answer": answers,
        "contexts": contexts_list,
        "ground_truth": ground_truths
    }
    hf_dataset = Dataset.from_dict(dataset_dict)
    
    print("\n📊 Стартиране на RAGAS евалюация (това може да отнеме минута-две)...")
    
    # Извикваме RAGAS. Той автоматично ще използва OPENAI_API_KEY от .env
    result = evaluate(
        hf_dataset,
        metrics=[
            faithfulness,         # Дали отговорът е верен спрямо контекста (няма халюцинации)
            answer_relevancy,     # Дали отговорът директно отговаря на въпроса
            context_precision,    # Дали RAG-ът е извлякъл релевантните параграфи най-отгоре
            context_recall        # Дали контекстът съдържа всичко нужно за ground_truth
        ],
    )
    
    print("\n✅ --- РЕЗУЛТАТИ ОТ ОЦЕНКАТА ---")
    print(result)
    
    # Запазване в CSV за по-лесен преглед и анализ в Excel
    df = result.to_pandas()
    df.to_csv("ragas_evaluation_results.csv", index=False, encoding='utf-8-sig')
    print("\n💾 Детайлните резултати бяха запазени в 'ragas_evaluation_results.csv'.")

    # Upload metrics to Langfuse
    if os.getenv("LANGFUSE_SECRET_KEY"):
        try:
            from langfuse import Langfuse
            print("\n☁️ Качване на резултатите в Langfuse...")
            langfuse = Langfuse()
            for index, row in df.iterrows():
                trace_id = f"eval-{index}-{os.urandom(4).hex()}"
                langfuse.trace(id=trace_id, name="RAGAS Evaluation", input=row["question"], output=row["answer"])
                
                if "faithfulness" in row and not type(row["faithfulness"]) == float and str(row["faithfulness"]).lower() != "nan":
                    langfuse.score(trace_id=trace_id, name="faithfulness", value=row["faithfulness"])
                if "answer_relevancy" in row and not type(row["answer_relevancy"]) == float and str(row["answer_relevancy"]).lower() != "nan":
                    langfuse.score(trace_id=trace_id, name="answer_relevancy", value=row["answer_relevancy"])
                if "context_precision" in row and not type(row["context_precision"]) == float and str(row["context_precision"]).lower() != "nan":
                    langfuse.score(trace_id=trace_id, name="context_precision", value=row["context_precision"])
                if "context_recall" in row and not type(row["context_recall"]) == float and str(row["context_recall"]).lower() != "nan":
                    langfuse.score(trace_id=trace_id, name="context_recall", value=row["context_recall"])
            
            langfuse.flush()
            print("✅ Резултатите са качени в Langfuse!")
        except Exception as e:
            print(f"⚠️ Грешка при качване в Langfuse: {e}")

if __name__ == "__main__":
    # Започваме с 3 въпроса за бърз тест. Ако искаш всички 20, промени max_samples=20
    evaluate_dataset("academy_eval_dataset.json", max_samples=3)
