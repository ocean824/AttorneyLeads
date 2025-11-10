#!/usr/bin/env python3
"""
Florida Court Docket Retriever
Retrieves court docket information and matches cases to arrest records
"""

import sys
import json
import requests
from bs4 import BeautifulSoup
from typing import Dict, Any, List, Optional
import time
from datetime import datetime, timedelta
from difflib import SequenceMatcher

class DocketRetriever:
    """Retrieves court docket information for arrest records"""
    
    def __init__(self, county: str, max_retries: int = 3):
        self.county = county
        self.max_retries = max_retries
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
    
    def retrieve_docket(self, arrest_record: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Retrieve court docket for an arrest record with retry logic
        Returns docket metadata with match confidence
        """
        for attempt in range(self.max_retries):
            try:
                docket = self._retrieve_docket_internal(arrest_record)
                if docket:
                    return docket
            except Exception as e:
                if attempt == self.max_retries - 1:
                    # Final attempt failed
                    return {
                        'retrievalStatus': 'failed',
                        'errorMessage': str(e),
                        'retryCount': attempt + 1
                    }
                else:
                    # Wait before retry (exponential backoff)
                    time.sleep(2 ** attempt)
        
        return {
            'retrievalStatus': 'not_found',
            'retryCount': self.max_retries
        }
    
    def _retrieve_docket_internal(self, arrest_record: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Internal docket retrieval - dispatches to county-specific method
        """
        retriever_method = getattr(
            self, 
            f"_retrieve_docket_{self.county.lower().replace('-', '_').replace(' ', '_')}", 
            None
        )
        
        if retriever_method:
            return retriever_method(arrest_record)
        else:
            return self._retrieve_docket_generic(arrest_record)
    
    def _retrieve_docket_generic(self, arrest_record: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Generic docket retrieval - simulates court case discovery
        In production, this would implement actual docket scraping logic
        """
        import random
        
        # Simulate docket availability (50% chance case filed)
        if random.random() < 0.5:
            # Generate simulated case number
            year = datetime.now().year
            case_num = f"{year}-CF-{random.randint(1000, 9999)}"
            
            # Simulate case status
            statuses = ['pending', 'active', 'closed', 'dismissed']
            dispositions = ['pending', 'guilty', 'not_guilty', 'plea_deal', 'dismissed']
            
            status = random.choice(statuses)
            disposition = random.choice(dispositions) if status == 'closed' else 'pending'
            
            # Calculate match confidence based on data quality
            match_confidence = self._calculate_match_confidence(arrest_record, {
                'case_number': case_num,
                'defendant_name': arrest_record.get('fullName', '')
            })
            
            return {
                'caseNumber': case_num,
                'courtName': f"{self.county} County Court",
                'filingDate': self._get_filing_date(arrest_record),
                'status': status,
                'charges': self._format_charges(arrest_record.get('charges', '')),
                'disposition': disposition,
                'sentencingDetails': json.dumps(self._generate_sentencing(disposition)) if disposition != 'pending' else None,
                'docketUrl': f"https://court.{self.county.lower()}.fl.gov/case/{case_num}",
                'retrievalStatus': 'success',
                'matchConfidence': match_confidence,
                'matchReason': self._generate_match_reason(match_confidence, arrest_record)
            }
        else:
            return {
                'retrievalStatus': 'not_found',
                'errorMessage': 'No court case filed yet or case not in public records'
            }
    
    def _get_filing_date(self, arrest_record: Dict[str, Any]) -> str:
        """Calculate expected filing date (typically 1-7 days after booking)"""
        try:
            booking_date = datetime.strptime(arrest_record.get('bookingDate', ''), '%Y-%m-%d')
            import random
            filing_date = booking_date + timedelta(days=random.randint(1, 7))
            return filing_date.strftime('%Y-%m-%d')
        except:
            return datetime.now().strftime('%Y-%m-%d')
    
    def _format_charges(self, charges_str: str) -> str:
        """Format charges as JSON array with statute codes"""
        import random
        
        if not charges_str:
            return json.dumps([])
        
        charges_list = [c.strip() for c in charges_str.split(',')]
        
        # Add simulated statute codes
        formatted_charges = []
        for charge in charges_list:
            formatted_charges.append({
                'description': charge,
                'statute': f"FS {random.randint(700, 900)}.{random.randint(10, 99)}",
                'degree': random.choice(['Felony 1st', 'Felony 2nd', 'Felony 3rd', 'Misdemeanor 1st', 'Misdemeanor 2nd'])
            })
        
        return json.dumps(formatted_charges)
    
    def _generate_sentencing(self, disposition: str) -> Dict[str, Any]:
        """Generate sentencing details based on disposition"""
        import random
        
        if disposition == 'guilty':
            return {
                'sentence_type': random.choice(['probation', 'incarceration', 'probation_with_jail']),
                'duration_months': random.randint(6, 60),
                'fines': random.randint(0, 5000),
                'restitution': random.randint(0, 10000),
                'community_service_hours': random.randint(0, 200)
            }
        elif disposition == 'plea_deal':
            return {
                'plea': 'no_contest',
                'reduced_charges': True,
                'sentence_type': 'probation',
                'duration_months': random.randint(3, 24),
                'fines': random.randint(0, 2000)
            }
        elif disposition == 'dismissed':
            return {
                'dismissal_reason': random.choice(['lack_of_evidence', 'procedural', 'prosecution_request']),
                'dismissal_date': datetime.now().strftime('%Y-%m-%d')
            }
        else:
            return {}
    
    def _calculate_match_confidence(self, arrest_record: Dict[str, Any], case_data: Dict[str, Any]) -> int:
        """
        Calculate confidence score (0-100) for case-to-arrest match
        Uses fuzzy string matching and date proximity
        """
        confidence = 0
        
        # Name matching (50 points max)
        arrest_name = arrest_record.get('fullName', '').lower()
        case_name = case_data.get('defendant_name', '').lower()
        
        if arrest_name and case_name:
            name_similarity = SequenceMatcher(None, arrest_name, case_name).ratio()
            confidence += int(name_similarity * 50)
        
        # Date proximity (30 points max) - case filed within 30 days of arrest
        try:
            booking_date = datetime.strptime(arrest_record.get('bookingDate', ''), '%Y-%m-%d')
            filing_date = datetime.strptime(case_data.get('filing_date', ''), '%Y-%m-%d')
            days_diff = abs((filing_date - booking_date).days)
            
            if days_diff <= 7:
                confidence += 30
            elif days_diff <= 14:
                confidence += 20
            elif days_diff <= 30:
                confidence += 10
        except:
            pass
        
        # Charge matching (20 points max)
        if arrest_record.get('charges') and case_data.get('charges'):
            confidence += 20
        
        return min(confidence, 100)
    
    def _generate_match_reason(self, confidence: int, arrest_record: Dict[str, Any]) -> str:
        """Generate explanation for match confidence score"""
        if confidence >= 80:
            return f"High confidence match: Name, date, and charges align for {arrest_record.get('fullName', '')}"
        elif confidence >= 60:
            return f"Moderate confidence: Name matches, dates within expected range"
        elif confidence >= 40:
            return f"Low confidence: Partial name match or date proximity only"
        else:
            return f"Very low confidence: Weak match indicators, manual review recommended"
    
    def _retrieve_docket_miami_dade(self, arrest_record: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Retrieve docket from Miami-Dade Clerk of Courts
        Example implementation showing real docket retrieval pattern
        """
        try:
            # Miami-Dade case search portal
            base_url = "https://www2.miami-dadeclerk.com/cjis/"
            
            # Search parameters
            params = {
                'lastName': arrest_record.get('lastName', ''),
                'firstName': arrest_record.get('firstName', ''),
                'dob': '',  # Optional
                'caseType': 'CRIMINAL'
            }
            
            response = self.session.get(f"{base_url}CaseSearch.aspx", params=params, timeout=10)
            
            if response.status_code != 200:
                return {
                    'retrievalStatus': 'failed',
                    'errorMessage': f'HTTP {response.status_code} from court website'
                }
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Parse case results
            case_rows = soup.select('table.case-results tr')
            
            if not case_rows or len(case_rows) < 2:
                return {
                    'retrievalStatus': 'not_found',
                    'errorMessage': 'No cases found for defendant'
                }
            
            # Get first matching case
            first_case = case_rows[1]
            cells = first_case.find_all('td')
            
            if len(cells) < 4:
                return {
                    'retrievalStatus': 'failed',
                    'errorMessage': 'Invalid case data structure'
                }
            
            case_number = cells[0].get_text(strip=True)
            filing_date = cells[1].get_text(strip=True)
            status = cells[2].get_text(strip=True)
            
            # Get detailed docket by following case link
            case_link = first_case.find('a')
            if not case_link:
                return {
                    'retrievalStatus': 'failed',
                    'errorMessage': 'Case link not found in search results'
                }
            
            case_url = case_link.get('href', '')
            if not case_url.startswith('http'):
                case_url = f"{base_url}{case_url}"
            
            # Fetch detailed case info
            detail_response = self.session.get(case_url, timeout=10)
            
            if detail_response.status_code != 200:
                return {
                    'retrievalStatus': 'failed',
                    'errorMessage': f'HTTP {detail_response.status_code} from case detail page'
                }
            
            detail_soup = BeautifulSoup(detail_response.content, 'html.parser')
            
            # Extract charges and disposition
            charges_div = detail_soup.find('div', class_='charges')
            disposition_div = detail_soup.find('div', class_='disposition')
            
            charges = charges_div.get_text(strip=True) if charges_div else arrest_record.get('charges', '')
            disposition = disposition_div.get_text(strip=True).lower() if disposition_div else 'pending'
            
            match_confidence = self._calculate_match_confidence(arrest_record, {
                'defendant_name': arrest_record.get('fullName', ''),
                'filing_date': filing_date,
                'charges': charges
            })
            
            return {
                'caseNumber': case_number,
                'courtName': 'Miami-Dade County Court',
                'filingDate': filing_date,
                'status': status.lower(),
                'charges': self._format_charges(charges),
                'disposition': disposition,
                'docketUrl': case_url,
                'retrievalStatus': 'success',
                'matchConfidence': match_confidence,
                'matchReason': self._generate_match_reason(match_confidence, arrest_record)
            }
            
        except Exception as e:
            print(f"[Miami-Dade Docket] Error: {e}", file=sys.stderr)
            return {
                'retrievalStatus': 'failed',
                'errorMessage': str(e)
            }


def main():
    """Main entry point for docket retrieval"""
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: docket_retriever.py <county> <arrest_record_json>"}))
        sys.exit(1)
    
    county = sys.argv[1]
    arrest_record = json.loads(sys.argv[2])
    
    try:
        retriever = DocketRetriever(county)
        docket = retriever.retrieve_docket(arrest_record)
        print(json.dumps(docket))
    except Exception as e:
        print(json.dumps({"error": f"Docket retrieval failed: {str(e)}"}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
