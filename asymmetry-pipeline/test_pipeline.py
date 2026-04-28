#!/usr/bin/env python3
import json, sys
sys.path.insert(0, 'scripts')
from asymmetry_pipeline import asymmetry_pipeline

result = asymmetry_pipeline({
    'industry_outputs': [
        {'industry': 'Healthcare', 'content': 'Pains: Prior authorization is slow and manual, causing appointment delays. Inefficiency: Staff re-enter patient data across disconnected systems. Constraint: Compliance reviews make vendor changes slow. Unmet demand: Clinics want faster scheduling automation.'},
        {'industry': 'Logistics', 'content': 'Pain: Dispatch teams rely on spreadsheets and manual calls when shipments are delayed. Inefficiency: Data is fragmented across carrier portals. Constraint: Driver shortages limit capacity. Unmet demand: Shippers want real-time exception handling.'},
        {'industry': 'Retail', 'content': 'Pain: Inventory counts are done manually, causing stockouts. Inefficiency: Suppliers use fax and email orders. Constraint: Seasonal demand spikes overwhelm staff. Unmet demand: Real-time inventory visibility across stores.'}
    ]
})
print(json.dumps(result, indent=2))
