// Copyright (c) 2023, CITC IIT Indore and contributors
// For license information, please see license.txt

frappe.ui.form.on('Leave cancel Request', {
	setup:function(frm){
		frm.trigger("year");
	},
	refresh: function(frm) {
		frm.trigger("year");
		let logged_user = frappe.session.user;
		if(frm.is_new()){
			var today = new Date();
			var yyyy = today.getFullYear();
			cur_frm.set_value("year",yyyy);
		}
		if (!frm.doc.employee && frappe.defaults.get_user_permissions()) {
			const perm = frappe.defaults.get_user_permissions();
			if (perm && perm['Employee']) {
				frm.set_value('employee', perm['Employee'].map(perm_doc => perm_doc.doc)[0]);
			}
		}
		if(frappe.session.user == 'hrmanager@iiti.ac.in'){
			frm.toggle_display("follow_via_email",true);
			cur_frm.set_df_property("total_leave_days","read_only",0);
		}
		if (!frm.is_new()) {
			if(frappe.session.user == 'hrmanager@iiti.ac.in'){
				frm.toggle_display("follow_via_email",true);
				cur_frm.set_df_property("total_leave_days","read_only",0);
				frm.set_df_property('status', 'options', ['Open', 'Approved', 'Not Approved'])
			}
			if(logged_user == frm.doc.approver && frm.doc.status == 'Open'){
				frm.disable_form();
				frm.add_custom_button(__('Approve'), function () {
					let action_type = 'Approved';
					leave_cancel_request_update(frm,action_type);
				}).addClass("btn-info").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': '#6495ed' });

				frm.add_custom_button(__('Reject'), function () {
					let action_type = 'Rejected';
					leave_cancel_request_update(frm, action_type);
	
				}).addClass("btn-danger").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': 'red' })
			}
		}
		// if(frm.doc.leave_application){
		// 	var leave_data = get_leave_application(frm);
		// 	frm.set_value("leave_type",leave_data.leave_type);
		// 	frm.set_value("from_date",leave_data.from_date);
		// 	frm.set_value("to_date",leave_data.to_date);
		// 	frm.set_value("total_leave_days",leave_data.total_leave_days);
		// 	frm.trigger("calculate_leave_day");
		// 	leave_cancel_display_data(frm,leave_data);
		// }
		
	},
	employee: function(frm) {
		frm.set_query("leave_application", function() {
			console.log("employee",frm.doc.employee)
			return {
				filters: {
					employee: frm.doc.employee, // Show only leave applications of the selected employee
					status: "Approved"  
				}
			};
		});
	},
	onload: function(frm) {
		let logged_user = frappe.session.user;
		if (!frm.is_new()) {

			if(frappe.session.user == 'hrmanager@iiti.ac.in'){
				frm.toggle_display("follow_via_email",true);
				cur_frm.set_df_property("total_leave_days","read_only",0);
				frm.set_df_property('status', 'options', ['Open', 'Approved', 'Not Approved'])
			}
			frm.toggle_display("from_date",true);
			frm.toggle_display("to_date",true);
			frm.toggle_display("total_leave_days",true);
			if(logged_user == frm.doc.approver && frm.doc.status == 'Open'){
				frm.disable_form();
				frm.add_custom_button(__('Approve'), function () {
					let action_type = 'Approved';
					leave_cancel_request_update(frm,action_type);
				}).addClass("btn-info").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': '#6495ed' });

				frm.add_custom_button(__('Reject'), function () {
					let action_type = 'Rejected';
					leave_cancel_request_update(frm, action_type);
	
				}).addClass("btn-danger").css({ 'color': '#ffffff', 'font-weight': 'bold', 'background-color': 'red' })
			}
		} else {
			frm.set_df_property('status', 'options', ['Open', 'Cancel']);
		}

		//filter for leave_application field only show approved applications
		cur_frm.fields_dict.leave_application.get_query = function(doc) {
			return {
				filters: {
					status: 'Approved',
					employee: frm.doc.employee,
					//leave_type: ['not in', 'Other Leave']
				},
			}
		}
	},
	leave_cancel_type:function(frm){
		if(frm.doc.leave_application){
			var leave_data = get_leave_application(frm);

			frm.toggle_display("from_date",true);
			frm.toggle_display("to_date",true);
			frm.toggle_display("total_leave_days",true);
			frm.set_value("from_date",leave_data.from_date);
			frm.set_value("to_date",leave_data.to_date);
			frm.set_df_property('from_date', 'reqd', 1);
			frm.set_df_property('to_date', 'reqd', 1);
			frm.set_df_property('total_leave_days', 'reqd', 1);
			frm.trigger("calculate_leave_day");
			leave_cancel_display_data(frm,leave_data);
			
		}
	},
	from_date:function(frm){
		frm.trigger("calculate_leave_day");
	},
	to_date:function(frm){
		frm.trigger("calculate_leave_day");
	},
	
	calculate_leave_day:function(frm){
		if (frm.doc.from_date && frm.doc.to_date && frm.doc.employee && frm.doc.leave_type) {

			var from_date = Date.parse(frm.doc.from_date);
			var to_date = Date.parse(frm.doc.to_date);

			if (to_date < from_date) {
				frappe.msgprint(__("To Date cannot be less than From Date"));
				frm.set_value('to_date', '');
				return;
			}
			// server call is done to include holidays in leave days calculations
			return frappe.call({
				method: 'admin_iiti.admin_iiti.doctype.leave_cancel_request.leave_cancel_request.get_number_of_leave_days',
				args: {
					"employee": frm.doc.employee,
					"leave_type": frm.doc.leave_type,
					"from_date": frm.doc.from_date,
					"to_date": frm.doc.to_date,
				},
				callback: function(r) {
					if (r && r.message) {
						console.log("ddd",r.message);
						frm.set_value('total_leave_days', r.message);
					}
				}
			});
		}
	},
	year:function(frm){
		if(frm.is_new()){
			var today = new Date();
			var yyyy = today.getFullYear();
			console.log("yyyy",yyyy);
			cur_frm.set_value("year",yyyy);
		}
	}
});
function get_leave_application(frm) {
	let details = []
	frappe.call({
		"method": 'admin_iiti.admin_iiti.doctype.leave_cancel_request.leave_cancel_request.get_leave_application_data',
		"args": {
			"name": frm.doc.leave_application,
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
function leave_cancel_display_data(frm,leave_data) {

	if (frm.doc.leave_cancel_type == 'Cancelled') {
		frm.set_value("total_leave_days", leave_data.total_leave_days);
		cur_frm.set_df_property("from_date", "read_only", 1);
		cur_frm.set_df_property("to_date", "read_only", 1);
	} else {
		frm.set_value("total_leave_days", '');
		cur_frm.set_df_property("from_date", "read_only", 0);
		cur_frm.set_df_property("to_date", "read_only", 0);

		if (leave_data.from_date) {
			var from_date = new Date(leave_data.from_date);
			var day = from_date.getDate();
			var year = from_date.getFullYear();
			var month = from_date.getMonth() + 1;
			cur_frm.fields_dict.from_date.datepicker.update({
				minDate: new Date(year, month - 1, day)
			});

			var to_date = new Date(leave_data.to_date);
			var day = to_date.getDate();
			var year = to_date.getFullYear();
			var month = to_date.getMonth() + 1;
			cur_frm.fields_dict.from_date.datepicker.update({
				maxDate: new Date(year, month - 1, day)
			});

		}

		if (leave_data.to_date) {
			var to_date = new Date(leave_data.to_date);
			var day = to_date.getDate();
			var year = to_date.getFullYear();
			var month = to_date.getMonth() + 1;
			cur_frm.fields_dict.to_date.datepicker.update({
				maxDate: new Date(year, month - 1, day)
			});

			var from_date = new Date(leave_data.from_date);
			var day = from_date.getDate();
			var year = from_date.getFullYear();
			var month = from_date.getMonth() + 1;
			cur_frm.fields_dict.to_date.datepicker.update({
				minDate: new Date(year, month - 1, day)
			});
		}
	}
}

function leave_cancel_request_update(frm,action_type) {
	frm.set_value("status",action_type);
	frm.set_value("doc_approved_date",frappe.datetime.now_datetime());
	frm.savesubmit();
	// frm.reload_doc();
	return action_type;
}

