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
                    frappe.throw(_("Today is {0} Birthday {1}").format(emp.employee_name, emp.date_of_birth))

def pending_leave_reminder():
    data = frappe.get_all('Leave Application',fields=["*"],filters=[['status','not in',['Amended','Rejected','Cancelled','Approved']],['docstatus','!=','2']])

    value = frappe.db.count('Leave Application',filters=[['status','not in',['Amended','Rejected','Cancelled','Approved']],['docstatus','!=','2']])

    for leave in data:
        if leave.status == 'Open':
            if leave.leave_recommenders:
                recommender_data = frappe.db.get_list('Indent Recommended',fields=["*"],filters=[
                    ["parent", "=", leave.name]
                    ])
                if recommender_data:
                    for recomm_list in recommender_data:
                        if recomm_list.status == 'Open':
                            send_leave_reminder(leave.name,recomm_list.recommender,1)

            else:
                if leave.leave_approver:
                    send_leave_reminder(leave.name,leave.leave_approver,2)
        
        elif leave.status == 'Recommended':
            send_leave_reminder(leave.name,leave.leave_approver,2)


def send_leave_reminder(docname,email_id,flag):
    if email_id:
        parent_doc = frappe.get_doc('Leave Application',docname)
        args = parent_doc.as_dict()

        if flag == 1:
            template = 'Leave Recommender Reminder'
        elif flag == 2:
            template = 'Leave Approver Reminder'
        else:
            template = ''

        email_template = frappe.get_doc("Email Template",template)

        if not email_template:
            frappe.msgprint(frappe._("please set default template for reminder."))
            return
        
        message = frappe.render_template(email_template.response_html,args)

        notify(args,{
            "message":message,
            "message_to":email_id,
            "subject":email_template.subject + " " + docname
        })
        

def notify(self, args):
    args = frappe._dict(args)
    # args -> message, message_to, subject
    if cint(self.follow_via_email):
        contact = args.message_to
        if not isinstance(contact, list):
            if not args.notify == "employee":
                contact = frappe.get_doc("User", contact).email or contact

        sender = dict()
        sender["email"] = frappe.get_doc("User", frappe.session.user).email
        sender["full_name"] = get_fullname(sender["email"])

        try:
            frappe.sendmail(
                recipients=contact,
                sender=sender["email"],
                subject=args.subject,
                message=args.message,
            )
            frappe.msgprint(frappe._("Email sent to {0}").format(contact))
        except frappe.OutgoingEmailError:
            pass