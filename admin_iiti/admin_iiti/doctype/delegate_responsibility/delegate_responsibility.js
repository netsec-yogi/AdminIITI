// Copyright (c) 2022, CITC IIT Indore and contributors
// For license information, please see license.txt

frappe.ui.form.on('Delegate Responsibility', {
	refresh: function(frm) {
		// console.log(frappe.session.logged_in_user);
		// get_employees(frappe.session.user);
		cur_frm.fields_dict.delegate_to.get_query = function(doc) {
			return {
				filters: {
					email: ['not in', [frappe.session.user]],
				}
			}
		}
	},
});