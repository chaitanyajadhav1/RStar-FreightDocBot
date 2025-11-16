#!/usr/bin/env python3
import sys
import json
import PyPDF2
import pdfplumber
import pikepdf
from pathlib import Path

def extract_with_pyPDF2(pdf_path):
    """Extract text using PyPDF2"""
    try:
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n\n"
            return text.strip()
    except Exception as e:
        return f"PyPDF2 Error: {str(e)}"

def extract_with_pdfplumber(pdf_path):
    """Extract text using pdfplumber (best for complex PDFs)"""
    try:
        text = ""
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n\n"
        return text.strip()
    except Exception as e:
        return f"PDFPlumber Error: {str(e)}"

def extract_with_pikepdf(pdf_path):
    """Extract text using pikepdf (handles Type3 fonts better)"""
    try:
        text = ""
        with pikepdf.open(pdf_path) as pdf:
            for page_num in range(len(pdf.pages)):
                page = pdf.pages[page_num]
                if '/Contents' in page:
                    # Simple text extraction - you might need more complex logic
                    text += f"Page {page_num + 1} - Content available\n"
        return text.strip() if text else "No extractable text found with pikepdf"
    except Exception as e:
        return f"PikePDF Error: {str(e)}"

def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Please provide PDF file path"}))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    
    if not Path(pdf_path).exists():
        print(json.dumps({"error": f"File not found: {pdf_path}"}))
        sys.exit(1)
    
    results = {}
    
    # Try pdfplumber first (most robust)
    results['pdfplumber'] = extract_with_pdfplumber(pdf_path)
    
    # If pdfplumber fails or returns little text, try others
    if not results['pdfplumber'] or len(results['pdfplumber']) < 100:
        results['pypdf2'] = extract_with_pyPDF2(pdf_path)
        results['pikepdf'] = extract_with_pikepdf(pdf_path)
    
    # Return the best result
    best_result = results['pdfplumber']
    if not best_result or len(best_result) < 100:
        best_result = results.get('pypdf2', '') or results.get('pikepdf', '')
    
    print(json.dumps({
        "success": True,
        "text": best_result,
        "length": len(best_result),
        "methods_used": list(results.keys())
    }))

if __name__ == "__main__":
    main()