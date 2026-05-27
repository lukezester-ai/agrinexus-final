# Архитектура на RAG системата за AgriNexus Academy Tutor

## 1. Обща Архитектура (High-level)

```text
User Query (български)
       ↓
[Query Rewriter / Router]
       ↓
[Retriever] ←→ Vector Store + Hybrid Search
       ↓
[Ranker / Reranker]
       ↓
[Context Selector]
       ↓
[LangGraph Agent / LLM Prompt]
       ↓
Final Answer + Sources + Explanation
```

## 2. Компоненти на RAG системата

| Компонент | Препоръчителна технология | Защо |
| --- | --- | --- |
| Document Loader | LangChain / LlamaIndex + custom loaders | Поддръжка на Markdown, PDF, DOCX |
| Chunking | Semantic Chunking + RecursiveCharacterTextSplitter | По-добро за агро съдържание |
| Embeddings | `sentence-transformers/paraphrase-multilingual-mpnet-base-v2` или `intfloat/multilingual-e5-large` | Отлични за български |
| Vector Store | PGVector (Supabase/PostgreSQL) или Chroma (начало) → Qdrant (по-късно) | PGVector = лесна интеграция |
| Reranker | `cross-encoder/ms-marco-MiniLM-L-6-v2` или `BGE-reranker` | Много подобрява качеството |
| LLM | Grok / Claude 3.5 / GPT-4o / Llama-3.1-70B | Grok или Claude за explainability |
| Orchestration | LangGraph (вече го имаш) | Перфектно за multi-agent |

## 3. Препоръчителен Pipeline

### A. Ingestion Pipeline (`build_academy_rag.py`)

```python
from langchain_community.document_loaders import DirectoryLoader, UnstructuredMarkdownLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import PGVector

# 1. Load
loader = DirectoryLoader("academy_content/", glob="**/*.md")
docs = loader.load()

# 2. Smart Chunking
splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=150,
    separators=["\n\n## ", "\n\n### ", "\n\n", "\n"]
)
chunks = splitter.split_documents(docs)

# 3. Metadata enrichment
for chunk in chunks:
    chunk.metadata["course"] = extract_course_name(chunk)
    chunk.metadata["topic"] = extract_topic(chunk)
    chunk.metadata["language"] = "bg"

# 4. Embed + Store
embeddings = HuggingFaceEmbeddings(model_name="intfloat/multilingual-e5-large")

vectorstore = PGVector.from_documents(
    documents=chunks,
    embedding=embeddings,
    collection_name="academy_tutor",
    connection_string=CONNECTION_STRING
)
```

### B. Retrieval Strategy (Hybrid + Rerank)

```python
async def retrieve_context(query: str, top_k=8):
    # Hybrid Search (vector + keyword)
    vector_results = vectorstore.similarity_search(query, k=12)
    
    # Keyword search (BM25 или pg_trgm)
    keyword_results = await keyword_search(query)
    
    # Merge + Rerank
    all_docs = vector_results + keyword_results
    reranker = CrossEncoderReranker(model_name="cross-encoder/ms-marco-MiniLM-L-6-v2")
    reranked = reranker.rerank(all_docs, query, top_k=top_k)
    
    return reranked
```

### C. Prompt Engineering (много важно за Academy)

```python
SYSTEM_PROMPT = """
Ти си AgriNexus Academy Tutor — практичен, честен и уважителен съветник по земеделие.
Отговаряй на български, с практически тон.
Използвай само предоставения контекст.
Ако не знаеш — кажи "Не съм сигурен, препоръчвам да провериш с агроном."
Винаги добавяй източник от Academy материала.
"""
```

## 4. LangGraph Workflow (Advanced)

Създай graph с няколко nodes:

- **Query Analyzer** → разбира дали въпросът е за конкретен курс, обща теория или практически съвет
- **Retriever**
- **Context Grader** → преценява дали контекстът е достатъчен
- **Answer Generator**
- **Explanation Node** → "Защо ти казвам това?"

## 5. Практически Съвети за Агро Академия

- **Metadata filtering** — филтрирай по култура (пшеница, домати), регион (Североизток), сезон.
- **Hierarchical Indexing** — course → module → lesson.
- **Dynamic Knowledge Update** — лесно добавяне на нови материали (cron job всяка седмица).
- **Grounding** — винаги показвай източниците (страница от курса).
- **Multi-query** — генерирай 3 варианта на въпроса за по-добро retrieval.

## 6. Технически Стъпки за Внедряване

### Фаза 1 (1–2 седмици)
- Създай ingestion pipeline
- Напълни PGVector с текущото Academy съдържание
- Направи прост endpoint `/tutor/chat`

### Фаза 2 (3–5 седмици)
- Добави reranker
- Hybrid search
- LangGraph orchestration

### Фаза 3
- Memory (per user)
- Multi-agent (един агент за теория, друг за практически съвети)
- Evaluation dataset (50+ въпроса от фермери)

### Автоматично Обновяване
За поддържане на RAG системата актуална (Dynamic Knowledge Update), се използва скриптът `update_rag_weekly.py`. 
Препоръчителна настройка за cron (на Linux/VPS), която да се изпълнява всяка неделя в 03:00:
```bash
0 3 * * 0 cd /path/to/agrinexus/apps/backend/rag && python update_rag_weekly.py >> logs/cron.log 2>&1
```

---

**Очакван резултат:**
Tutor-ът ще става значително по-точен, по-малко "халюцинира" и ще се усеща като реален агроном, който е прочел всички твои материали.
