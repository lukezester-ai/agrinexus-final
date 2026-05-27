from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall,
    answer_correctness
)
from datasets import Dataset
import json

# Плейсхолдъри за LLM и Embeddings 
llm = None
embeddings = None

# Примерен тестов dataset (създай файл academy_eval_dataset.json)
def load_eval_dataset():
    with open("academy_eval_dataset.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    
    return Dataset.from_dict({
        "question": [item["question"] for item in data],
        "answer": [item["answer"] for item in data],           # генериран отговор
        "contexts": [item["contexts"] for item in data],       # списък с контекст
        "ground_truth": [item["ground_truth"] for item in data]
    })

def evaluate_rag():
    dataset = load_eval_dataset()
    
    result = evaluate(
        dataset=dataset,
        metrics=[
            faithfulness,
            answer_relevancy,
            context_precision,
            context_recall,
            answer_correctness
        ],
        llm=llm,                    # твоя LLM
        embeddings=embeddings
    )
    
    print("=== RAG Evaluation Results ===")
    for metric, score in result.items():
        print(f"{metric}: {score:.4f}")
    
    return result

# Примерна структура на academy_eval_dataset.json
"""
[
  {
    "question": "Кога да се сее пшеница в Североизточна България?",
    "answer": "...",
    "contexts": ["текст от academy..."],
    "ground_truth": "Оптималният период е от 1 до 25 октомври..."
  }
]
"""
# Препоръка: Създай минимум 60–80 тестови въпроса, покриващи различни теми.
