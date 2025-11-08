# Copyright (c) 2025, CITC IIT Indore and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document

class NoteSheetApprovalProcess(Document):
	pass

import frappe

@frappe.whitelist()
def get_employee_data(user_id):
    employee = frappe.get_value("Employee", {"user_id": user_id}, ['department', 'designation','employee_id','employee_name','salutation'], as_dict=True)
    if employee:
        return {
            "department": employee.get("department", ""),
            "designation": employee.get("designation", ""),
            "employee_id": employee.get("employee_id", ""),
            "employee_name": employee.get("employee_name", ""),
            "salutation": employee.get("salutation", "")
        }
    return {}
