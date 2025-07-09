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
		if (frm.is_new()) {
			frm.set_value('status','Open');
		}else if(!frm.is_new()){
			if(frappe.session.user == 'hrmanager@iiti.ac.in'){
				frm.toggle_display("status",true);
				frm.toggle_display("follow_via_email",true);
				cur_frm.set_df_property("total_leave_days","read_only",0);
				frm.set_df_property('status', 'options', ['Open', 'Approved', 'Not Approved'])
			}
			if (frm.doc.approver == frappe.session.user && frm.doc.status == 'Open'){
				frm.disable_form();
				frm.add_custom_button(__('Approve'), function () {
					let action_type = 'Approved';
					joining_report_status_update(frm,action_type);
				}).addClass("btn-info").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': '#6495ed' });

				frm.add_custom_button(__('Reject'), function () {
					let action_type = 'Rejected';
					joining_report_status_update(frm, action_type);
	
				}).addClass("btn-danger").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': 'red' })
			}
			if(frm.doc.approver == frappe.session.user && frm.doc.status == 'Approved'){
				frm.add_custom_button(__('Approved'), function () {
					frappe.msgprint('Joining Report already Approved');
				}).addClass("btn-info").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': '#1eb817ab' })
			}
			//p: reporting date validation added 

			if(frm.doc.reporting_date){
				var from_date = new Date(frm.doc.reporting_date);
				var day = from_date.getDate();
				var year = from_date.getFullYear();
				var month = from_date.getMonth()+1;
				console.log(frm.doc.reporting_date);
				console.log(frm.fields_dict.reporting_date.datepicker);
				frm.fields_dict.reporting_date.datepicker.update({minDate: new Date(year, month - 1, day)})
			}
		}
	},
	onload: function(frm) {
		if (frm.is_new()) {
			frm.set_value('status','Open');
		}else if(!frm.is_new()){
			if(frappe.session.user == 'hrmanager@iiti.ac.in'){
				frm.toggle_display("status",true);
				frm.toggle_display("follow_via_email",true);
				cur_frm.set_df_property("total_leave_days","read_only",0);
				frm.set_df_property('status', 'options', ['Open', 'Approved', 'Not Approved'])
			}
			if (frm.doc.approver == frappe.session.user && frm.doc.status == 'Open'){
				frm.disable_form();
				frm.add_custom_button(__('Approve'), function () {
					let action_type = 'Approved';
					joining_report_status_update(frm,action_type);
				}).addClass("btn-info").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': '#6495ed' });

				frm.add_custom_button(__('Reject'), function () {
					let action_type = 'Rejected';
					joining_report_status_update(frm, action_type);
	
				}).addClass("btn-danger").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': 'red' });

				if(frm.doc.approver == frappe.session.user && frm.doc.status == 'Approved'){
					frm.add_custom_button(__('Approved'), function () {
						frappe.msgprint('Joining Report already Approved');
					}).addClass("btn-info").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': '#1eb817ab' })
				}
			}
		}

	},
	setup: function(frm) {
		frm.set_query("approver", function() {
			return {
				query: 'admin_iiti.overrides.get_approvers',
			};
		});
		if(frm.doc.employee){
			let data = get_leave_data(frm);
			//filter for leave_application field only show approved applications
			cur_frm.fields_dict.leave_application.get_query = function(doc) {
				return {
					filters: {
						name : ['IN',data]
					},
					order_by: 'posting_date desc',
				}
			}
		}
		
		
	},
	leave_application:function(frm){
		if (frm.doc.leave_application){
			frappe.call({
				method: "frappe.client.get_value",
				args: {
					doctype: "Leave Application",
					filters: {
						"name":frm.doc.leave_application,
					},
					fieldname: ["*"]
				},
				async: false,
				callback: function(r){
					let data = r.message;
					frm.set_value("approver",data.leave_approver);
				} 
			});
		}
	},
	reporting_date:function(frm){
		console.log(frm.doc.reporting_date);
		var from_date = new Date(frm.doc.reporting_date);
		var day = from_date.getDate();
		var year = from_date.getFullYear();
		var month = from_date.getMonth()+1;
		cur_frm.fields_dict.reporting_date.datepicker.update({
		 minDate: new Date(year, month - 1, day)
		});
	}

});
function joining_report_status_update(frm,action_type) {
	frm.set_value("status",action_type);
	frm.savesubmit();
	// frm.reload_doc();
	return action_type;
}
function get_leave_data(frm) {
	let details = []
	frappe.call({
		"method": 'admin_iiti.admin_iiti.doctype.employee_joining_report.employee_joining_report.get_leave_data',
		"args": {
			"employee": frm.doc.employee,
		},
		"async": false,
		callback: function (r) {
			let  data = r.message;
			if (r && r.message) {
				details = data;
			}
		}
		
	});
	return details;
}