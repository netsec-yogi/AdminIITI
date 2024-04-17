// Copyright (c) 2023, CITC IIT Indore and contributors
// For license information, please see license.txt

frappe.ui.form.on('Leave cancel Request', {
	refresh: function(frm) {
		if (!frm.doc.employee && frappe.defaults.get_user_permissions()) {
			const perm = frappe.defaults.get_user_permissions();
			if (perm && perm['Employee']) {
				frm.set_value('employee', perm['Employee'].map(perm_doc => perm_doc.doc)[0]);
			}
		}
		if(frappe.session.user == 'hrmanager@iiti.ac.in'){
			frm.toggle_display("follow_via_email",true);
		}
	},
	onload: function(frm) {
		console.log(frm);

		//set_status open for employee();
		if (!frm.is_new()) {
			if (!frm.is_new()) {
				if (frappe.session.user === frm.doc.owner) {
					frm.set_df_property('status', 'options', ['Open', 'Cancel']);
				} else if (frappe.session.user === frm.doc.approver) {
					frm.set_df_property('status', 'options', ['Open', 'Approved', 'Not Approved'])
				}
				if(frappe.session.user == 'hrmanager@iiti.ac.in'){
					frm.toggle_display("follow_via_email",true);
					frm.set_df_property('status', 'options', ['Open', 'Approved', 'Not Approved'])
				}
			}
		} else {
			frm.set_df_property('status', 'options', ['Open', 'Cancel']);
			cur_frm.set_df_property("from_date", "read_only", 1);
			cur_frm.set_df_property("to_date", "read_only", 1);
		}

		//filter for leave_application field only show approved applications
		cur_frm.fields_dict.leave_application.get_query = function(doc) {
			return {
				filters: {
					status: 'Approved',
				},
			}
		}
	},
});
