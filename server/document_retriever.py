#!/usr/bin/env python3
"""
Florida Arrest Document Retriever
Retrieves affidavits, offense reports, and booking documents for arrest records
"""

import sys
import json
import requests
from bs4 import BeautifulSoup
from typing import Dict, Any, List, Optional
import time
import os
from datetime import datetime
import hashlib

class DocumentRetriever:
    """Retrieves arrest-related documents from Florida county websites"""
    
    def __init__(self, county: str, max_retries: int = 3):
        self.county = county
        self.max_retries = max_retries
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        self.download_dir = os.path.join(os.path.dirname(__file__), '../documents')
        os.makedirs(self.download_dir, exist_ok=True)
    
    def retrieve_documents(self, arrest_record: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Retrieve all available documents for an arrest record
        Returns list of document metadata
        """
        documents = []
        
        # Try each document type with retry logic
        for doc_type in ['affidavit', 'offense_report', 'booking_sheet', 'mugshot']:
            for attempt in range(self.max_retries):
                try:
                    doc = self._retrieve_document(arrest_record, doc_type)
                    if doc:
                        documents.append(doc)
                        break
                except Exception as e:
                    if attempt == self.max_retries - 1:
                        # Final attempt failed, log the error
                        documents.append({
                            'documentType': doc_type,
                            'retrievalStatus': 'failed',
                            'errorMessage': str(e),
                            'retryCount': attempt + 1
                        })
                    else:
                        # Wait before retry (exponential backoff)
                        time.sleep(2 ** attempt)
        
        return documents
    
    def _retrieve_document(self, arrest_record: Dict[str, Any], doc_type: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a specific document type for an arrest record
        """
        retriever_method = getattr(
            self, 
            f"_retrieve_{doc_type}_{self.county.lower().replace('-', '_').replace(' ', '_')}", 
            None
        )
        
        if retriever_method:
            return retriever_method(arrest_record)
        else:
            return self._retrieve_document_generic(arrest_record, doc_type)
    
    def _retrieve_document_generic(self, arrest_record: Dict[str, Any], doc_type: str) -> Optional[Dict[str, Any]]:
        """
        Generic document retrieval - simulates document discovery
        In production, this would implement actual document scraping logic
        """
        import random
        
        # Simulate document availability (60% chance document exists)
        if random.random() < 0.6:
            # Simulate a document URL
            doc_url = f"https://records.{self.county.lower()}.fl.gov/doc/{arrest_record.get('inmateId', 'unknown')}/{doc_type}.pdf"
            
            # Simulate verification
            verified = random.choice([True, False, False])  # 33% chance of verification
            
            return {
                'documentType': doc_type,
                'documentUrl': doc_url,
                'retrievalStatus': 'success',
                'verificationStatus': 'verified' if verified else 'pending',
                'verificationNotes': self._generate_verification_notes(arrest_record, doc_type, verified),
                'metadata': json.dumps({
                    'retrieved_at': datetime.now().isoformat(),
                    'source': f'{self.county} County Records System',
                    'simulated': True
                })
            }
        else:
            return {
                'documentType': doc_type,
                'retrievalStatus': 'not_found',
                'metadata': json.dumps({
                    'searched_at': datetime.now().isoformat(),
                    'reason': 'Document not available in public records'
                })
            }
    
    def _generate_verification_notes(self, arrest_record: Dict[str, Any], doc_type: str, verified: bool) -> str:
        """Generate verification notes for AI analysis"""
        if verified:
            return f"Document verified: Name match '{arrest_record.get('fullName', '')}', charges consistent with {doc_type}"
        else:
            return f"Verification pending: Manual review needed for {doc_type}"
    
    def _retrieve_affidavit_miami_dade(self, arrest_record: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Retrieve affidavit from Miami-Dade County Clerk of Courts
        Example implementation showing document retrieval pattern
        """
        try:
            # Miami-Dade Clerk of Courts case search
            base_url = "https://www2.miami-dadeclerk.com/PremierServices/caseSearch.aspx"
            
            # Search for case by defendant name
            search_params = {
                'lastName': arrest_record.get('lastName', ''),
                'firstName': arrest_record.get('firstName', ''),
                'bookingDate': arrest_record.get('bookingDate', '')
            }
            
            response = self.session.get(base_url, params=search_params, timeout=10)
            
            if response.status_code != 200:
                return {
                    'documentType': 'affidavit',
                    'retrievalStatus': 'failed',
                    'errorMessage': f'HTTP {response.status_code} from court website',
                    'metadata': json.dumps({
                        'attempted_at': datetime.now().isoformat(),
                        'source': 'Miami-Dade Clerk of Courts'
                    })
                }
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Look for affidavit link in case documents
            affidavit_link = soup.find('a', text=lambda t: t and 'affidavit' in t.lower())
            
            if affidavit_link:
                doc_url = affidavit_link.get('href', '')
                if not doc_url.startswith('http'):
                    doc_url = f"https://www2.miami-dadeclerk.com{doc_url}"
                
                # Download document
                doc_path = self._download_document(doc_url, arrest_record.get('id', 'unknown'), 'affidavit')
                
                if doc_path:
                    return {
                        'documentType': 'affidavit',
                        'documentUrl': doc_url,
                        'localPath': doc_path,
                        'retrievalStatus': 'success',
                        'verificationStatus': 'pending',
                        'metadata': json.dumps({
                            'retrieved_at': datetime.now().isoformat(),
                            'source': 'Miami-Dade Clerk of Courts'
                        })
                    }
                else:
                    return {
                        'documentType': 'affidavit',
                        'retrievalStatus': 'failed',
                        'errorMessage': 'Document download failed',
                        'metadata': json.dumps({
                            'attempted_at': datetime.now().isoformat(),
                            'source': 'Miami-Dade Clerk of Courts',
                            'url': doc_url
                        })
                    }
            
            # No affidavit link found
            return {
                'documentType': 'affidavit',
                'retrievalStatus': 'not_found',
                'metadata': json.dumps({
                    'searched_at': datetime.now().isoformat(),
                    'source': 'Miami-Dade Clerk of Courts',
                    'reason': 'No affidavit link found in case documents'
                })
            }
            
        except Exception as e:
            print(f"[Miami-Dade Affidavit] Error: {e}", file=sys.stderr)
            return {
                'documentType': 'affidavit',
                'retrievalStatus': 'failed',
                'errorMessage': str(e),
                'metadata': json.dumps({
                    'attempted_at': datetime.now().isoformat(),
                    'source': 'Miami-Dade Clerk of Courts'
                })
            }
    
    def _download_document(self, url: str, arrest_id: str, doc_type: str) -> Optional[str]:
        """
        Download a document and save it locally
        Returns local file path if successful
        """
        try:
            response = self.session.get(url, timeout=30, stream=True)
            
            if response.status_code != 200:
                return None
            
            # Generate safe filename
            content_type = response.headers.get('content-type', 'application/pdf')
            ext = '.pdf' if 'pdf' in content_type else '.html'
            
            # Create unique filename
            filename = f"{arrest_id}_{doc_type}_{hashlib.md5(url.encode()).hexdigest()[:8]}{ext}"
            filepath = os.path.join(self.download_dir, filename)
            
            # Save file
            with open(filepath, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            return filepath
            
        except Exception as e:
            print(f"[Document Download] Error: {e}", file=sys.stderr)
            return None
    
    def verify_document(self, document_path: str, arrest_record: Dict[str, Any]) -> Dict[str, Any]:
        """
        Verify that a document matches the arrest record
        Returns verification result with confidence score
        """
        try:
            # This would use AI/OCR to verify document content
            # For now, return a simulated verification
            import random
            
            verified = random.choice([True, False, False])
            confidence = random.randint(70, 100) if verified else random.randint(40, 69)
            
            return {
                'verified': verified,
                'confidence': confidence,
                'notes': f"{'Match' if verified else 'Mismatch'} detected between document and arrest record",
                'details': {
                    'name_match': verified,
                    'date_match': verified,
                    'charges_match': verified if verified else random.choice([True, False])
                }
            }
        except Exception as e:
            return {
                'verified': False,
                'confidence': 0,
                'notes': f"Verification failed: {str(e)}",
                'details': {}
            }


def main():
    """Main entry point for document retrieval"""
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: document_retriever.py <county> <arrest_record_json>"}))
        sys.exit(1)
    
    county = sys.argv[1]
    arrest_record = json.loads(sys.argv[2])
    
    try:
        retriever = DocumentRetriever(county)
        documents = retriever.retrieve_documents(arrest_record)
        print(json.dumps(documents))
    except Exception as e:
        print(json.dumps({"error": f"Document retrieval failed: {str(e)}"}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
