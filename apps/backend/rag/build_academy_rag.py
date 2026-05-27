import os
from dotenv import load_dotenv
from langchain_community.document_loaders import DirectoryLoader, UnstructuredMarkdownLoader, PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import PGVector
from langchain_core.documents import Document
import psycopg2
from tqdm import tqdm

load_dotenv()

# ================== CONFIG ==================
CONNECTION_STRING = os.getenv("POSTGRES_CONNECTION_STRING")
COLLECTION_NAME = "academy_tutor_v1"
EMBEDDING_MODEL = "intfloat/multilingual-e5-large"   # много добър за български

# ===========================================

def load_documents(directory: str):
    """Load Markdown and PDF files"""
    docs = []
    
    # Markdown files
    md_loader = DirectoryLoader(
        directory,
        glob="**/*.md",
        loader_cls=UnstructuredMarkdownLoader,
        loader_kwargs={"mode": "elements"}
    )
    docs.extend(md_loader.load())
    
    # PDF files
    pdf_loader = DirectoryLoader(
        directory,
        glob="**/*.pdf",
        loader_cls=PyPDFLoader
    )
    docs.extend(pdf_loader.load())
    
    print(f"Заредени {len(docs)} документа")
    return docs


def enrich_metadata(docs):
    """Добавяне на полезни метаданни"""
    for doc in docs:
        source = doc.metadata.get("source", "")
        doc.metadata["course"] = source.split("/")[1] if len(source.split("/")) > 1 else "general"
        doc.metadata["language"] = "bg"
        doc.metadata["chunk_type"] = "text"
        
        # Extract topic from filename or first heading
        if "topic" not in doc.metadata:
            filename = os.path.basename(source)
            doc.metadata["topic"] = filename.replace(".md", "").replace("_", " ").title()
    return docs


def main():
    print("🚀 Стартиране на Ingestion Pipeline...")

    # 1. Load
    raw_docs = load_documents("academy_content")   # ← твоята папка

    # 2. Enrich
    docs = enrich_metadata(raw_docs)

    # 3. Smart Chunking
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=850,
        chunk_overlap=120,
        separators=["\n\n## ", "\n\n### ", "\n\n#### ", "\n\n", "\n", " "],
        length_function=len
    )
    
    chunks = text_splitter.split_documents(docs)
    print(f"Създадени {len(chunks)} чънка")

    # 4. Embeddings
    embeddings = HuggingFaceEmbeddings(
        model_name=EMBEDDING_MODEL,
        model_kwargs={'device': 'cpu'},
        encode_kwargs={'normalize_embeddings': True}
    )

    # 5. Store in PGVector
    vectorstore = PGVector.from_documents(
        documents=chunks,
        embedding=embeddings,
        collection_name=COLLECTION_NAME,
        connection_string=CONNECTION_STRING,
        use_jsonb=True,           # по-добро за PostgreSQL 15+
    )

    print(f"✅ Успешно заредено в колекция: {COLLECTION_NAME}")


if __name__ == "__main__":
    main()
