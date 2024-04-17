// Copyright (c) 2022, CITC IIT Indore and contributors
// For license information, please see license.txt
cur_frm.add_fetch('employee', 'employee_name', 'employee_name')
cur_frm.add_fetch('employee', 'department', 'department')
frappe.ui.form.on('Employee Joining Report', {
	refresh: function(frm) {
		if (!frm.doc.employee && frappe.defaults.get_user_permissions()) {
			const perm = frappe.defaults.get_user_permissions();
			if (perm && perm['Employee']) {
				frm.set_value('employee', perm['Employee'].map(perm_doc => perm_doc.doc)[0]);
			}
		}
	},
	onload: function(frm) {
		//console.log(frm);
		//set_status open for employee();
		if (frm.is_new()) {
			frm.set_df_property('status', 'options', ['Open','Cancel'])
		}else if(!frm.is_new()){
			if(frappe.session.user==frm.doc.owner){
					frm.set_df_property('status', 'options', ['Open','Cancel'])
			}else if(frappe.session.user==frm.doc.approver){
				frm.set_df_property('status', 'options', ['Open','Approved','Not Approved'])
			}
		}

        //filter for leave_application field only show approved applications
		cur_frm.fields_dict.leave_application.get_query = function(doc) {
			return {
				filters: {
					status: 'Approved',
					employee : doc.employee
				},
				order_by: 'posting_date desc',
			}
		}
        if(frm.doc.employee!=''){
			var employee = frm.doc.employee;
			var employee_detail = get_emp_detail(employee);
			var department = employee_detail.department;
			// var leave_approver = get_employee_hod(department,'HOD','HOD');
			// cur_frm.set_value('approver',leave_approver);
		}
	},
	employee:function(frm){
		if(frm.doc.employee!=''){
			var employee = frm.doc.employee;
			var employee_detail = get_emp_detail(employee);
			var department = employee_detail.department;
			// var leave_approver = get_employee_hod(department,'HOD','HOD');
			// cur_frm.set_value('approver',leave_approver);
	    }
	},
	// approver:function (frm) {
	//
	//
	// }
	setup: function(frm) {
		frm.set_query("approver", function() {
			return {
				query: 'admin_iiti.overrides.get_approvers',
			};
		});
	},
});

function get_emp_detail(employee){
	var emp_detail = [];
	frappe.call({
		method: "frappe.client.get_value",
		args: {
			doctype: "Employee",
			filters: {
				"name":employee,
			},
			fieldname: ["*"]
		},
		async: false,
		callback: function(r){
	        emp_detail=r.message;
		} 
	});
    return emp_detail;
}

function get_employee_hod(emp_main_department,position_department,position){
    var email = "";
	frappe.call({
		method: "admin_iiti.overrides.get_employee_by_position",
		async: false,
		args: {
			"postion_department": position_department,
			"position":position,
			"emp_main_department":emp_main_department
		},
		callback: function (r) {
		     if(r.message.length>0){
                email = r.message[0].user_id;
			 }
		}
	});
	return email;
}