import erpnext
import json
import frappe
import datetime
from frappe import _
from frappe.utils import (
    add_days,
    cint,
    cstr,
    date_diff,
    flt,
    formatdate,
    get_fullname,
    get_link_to_form,
    getdate,
    nowdate,
    now_datetime
)

def birthday_reminder_non_teaching():
    data = frappe.get_all('Employee',fields=["*"], filters=[["status", "=","Active"],["employee_category", "=","Non-Teaching"]])
    
    value = frappe.db.count("Employee",filters=[["status", "=","Active"],["employee_category", "=","Non-Teaching"]])
    
    CurrentDay = now_datetime().day
    CurrentMonth = now_datetime().month
    Currentyear = now_datetime().year
    
    if data:
        for emp in data:
            if emp.date_of_birth:
                emp_day = getdate(emp.date_of_birth).day
                emp_month = getdate(emp.date_of_birth).month
                emp_year = getdate(emp.date_of_birth).year
                
                if CurrentDay == emp_day and CurrentMonth == emp_month and emp_year < Currentyear :
                    frappe.throw(_("Today is the {0} Birthday {1}").format(emp.employee_name, emp.date_of_birth))
    
    