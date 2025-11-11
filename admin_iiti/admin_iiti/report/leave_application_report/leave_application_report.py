# Copyright (c) 2025, CITC IIT Indore and contributors
# For license information, please see license.txt

# import frappe


# def execute(filters=None):
# 	columns, data = [], []
# 	return columns, data



import frappe
from frappe import _
from frappe.utils import flt

def execute(filters=None):
    filters = filters or {}
    columns = get_columns()
    rows = get_rows(filters)
    return columns, rows

def get_columns():
    return [
        # {"label": _("Sl. No."), "fieldname": "idx", "fieldtype": "Int", "width": 70},
        {"label": _("Name"), "fieldname": "name", "fieldtype": "Link", "options": "Leave Application", "width": 110},
        {"label": _("PNT Number"), "fieldname": "pnt_number", "fieldtype": "Data", "width": 130},
        {"label": _("Employee Name"), "fieldname": "employee_name", "fieldtype": "Data", "width": 160},
        {"label": _("Designation"), "fieldname": "emp_designation", "fieldtype": "Data", "width": 130},
        {"label": _("Group"), "fieldname": "group", "fieldtype": "Link", "options": "Leave Application", "width": 110},
        {"label": _("Leave Type"), "fieldname": "leave_type_name", "fieldtype": "Data", "width": 140},
        {"label": _("Application Date"), "fieldname": "application_date", "fieldtype": "Date", "width": 120},
        {"label": _("From"), "fieldname": "from_date", "fieldtype": "Date", "width": 110},
        {"label": _("To"), "fieldname": "to_date", "fieldtype": "Date", "width": 110},
        {"label": _("No. of Days"), "fieldname": "no_of_days", "fieldtype": "Float", "width": 110},
        {"label": _("Reason"), "fieldname": "reason", "fieldtype": "Small Text", "width": 220},
        {"label": _("Reporting Authority"), "fieldname": "reporting_authority", "fieldtype": "Data", "width": 180},
        {"label": _("Approving Authority"), "fieldname": "approving_authority", "fieldtype": "Data", "width": 180},
        {"label": _("Leave Status"), "fieldname": "leave_status", "fieldtype": "Data", "width": 120},
    ]

def get_filter_dict(filters):
    filter_dict = {"docstatus": ["<", 2]}
    if filters.get("company"):
        filter_dict["company"] = filters["company"]
    if filters.get("department"):
        filter_dict["department"] = filters["department"]
    if filters.get("employee"):
        filter_dict["employee"] = filters["employee"]
    if filters.get("leave_type"):
        filter_dict["leave_type"] = filters["leave_type"]
    if filters.get("group"):
        filter_dict["group"] = filters["group"]
    if filters.get("status"):
        filter_dict["status"] = filters["status"]
    # Use posting date since it's for application timing; adjust to from_date/to_date window if that's preferred
    if filters.get("from_date") and filters.get("to_date"):
        filter_dict["from_date"] = ["between", [filters["from_date"], filters["to_date"]]]
    elif filters.get("from_date"):
        filter_dict["from_date"] = [">=", filters["from_date"]]
    elif filters.get("to_date"):
        filter_dict["to_date"] = ["<=", filters["to_date"]]
    return filter_dict

def get_rows(filters):
    filter_dict = get_filter_dict(filters)
    apps = frappe.get_all(
        "Leave Application",
        fields=[
            "name", "employee", "employee_name", "approver_designation as designation",
            "group", "leave_type_name", "leave_type", "posting_date as application_date",
            "from_date", "to_date", "half_day", "total_leave_days", "description", "leave_approver as approving_authority",
            "leave_approver_name", "status as leave_status"
        ],
        filters=filter_dict,
        order_by="posting_date desc, from_date desc, employee_name asc"
    )
    rows = []
    for idx, app in enumerate(apps, 1):
        # Fetch all child table rows for this Leave Application
        child_rows = frappe.get_all(
            "Leave Recommender",
            fields=["recommender_name"],
            filters={"parent": app["name"]}
        )
        names = [r["recommender_name"] for r in child_rows if r.get("recommender_name")]
        # ✅ Fetch Employee Info (pnt, designation, department etc.)
        emp_info = frappe.db.get_value(
            "Employee",
            app["employee"],
            ["pnt_number", "designation as emp_designation"],
            as_dict=True
        ) or {}
        app_data = {
            "idx": idx,
            "name": app["name"],
            "employee_name": app["employee_name"],
            "designation": app["designation"],
            "pnt_number": emp_info.get("pnt_number") or '',
            "emp_designation": emp_info.get("emp_designation") or '',  # prefer employee's designation
            "group": app["group"],
            "leave_type_name": app["leave_type_name"] if app["leave_type_name"] else app["leave_type"],
            "application_date": app["application_date"],
            "from_date": app["from_date"],
            "to_date": app["to_date"],
            "no_of_days": 0.5 if app["half_day"] else app["total_leave_days"],
            "reason": app["description"],
            "reporting_authority": ", ".join(names),
            "approving_authority": app["leave_approver_name"] if app["leave_approver_name"] else app["approving_authority"],
            "leave_status": app["leave_status"]
        }
        rows.append(app_data)
    return rows
