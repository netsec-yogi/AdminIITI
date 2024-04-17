frappe.ui.form.on("Leave Application", {
	setup: function(frm) {
		frm.set_query("leave_approver", function() {
			return {
				query: "admin_iiti.overrides.get_approvers",
				filters: {
					'enabled': 1
				}
			};
		});

		frm.set_query("employee", erpnext.queries.employee);
	},
	leave_approver : function(frm) {
		if (frm.doc.leave_approver) {			
			frappe.db.get_value('User', {'name': frm.doc.leave_approver}, 'full_name', (d) =>{
				frm.set_value("leave_approver_name",d.full_name);
			})
			
		}
    },
});