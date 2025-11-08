if (frappe.user.has_role('Leave Approver')) {
	let session_user = frappe.session.user;
	frappe.listview_settings['Leave Application'] = {
		add_fields: ["leave_type", "employee", "employee_name", "total_leave_days", "from_date", "to_date",'owner'],
        //filters: [["status", "=", '']],
		// filters: [
		// 	['leave_recommender', '=', session_user]
		// ],
		
		has_indicator_for_draft: 1,

		get_indicator: function (doc) {
			//console.log(frappe.session.user);
			if (doc.status === "Approved") {
				return [__("Approved"), "green", "status,=,Approved"];
			} else if (doc.status === "Rejected") {
				return [__("Rejected"), "red", "status,=,Rejected"];
			}
			else if (doc.status === "Recommended") {
				return [__("Recommended"), "yellow", "status,=,Recommended"];
			}
			else if (doc.status === "Amended") {
				return [__("Amended"), "blue", "status,=,Amended"];
			}
			else if (doc.status === "Cancelled") {
				return [__("Cancelled"), "red", "status,=,Cancelled"];
			}
			 else {
				return [__("Open"), "red", "status,=,Open"];
			}
		},
	}
}else{
	frappe.listview_settings['Leave Application'] = {
		add_fields: ["leave_type", "employee", "employee_name", "total_leave_days", "from_date", "to_date",'owner'],
		has_indicator_for_draft: 1,

		onload: function(listview) {
			// let logged_user = frappe.session.user;
			// frappe.db.get_value('Employee', {'user_id': logged_user}, 'name', (d) =>{
			// 	frappe.set_route('List', 'Leave Application','List');
			// 	frappe.route_options = {
			// 		"employee": ["=",d.name]
			// 	};
			// })
			
			frappe.route_options = {
				"status": ["="," "]
			};
			
		},
		get_indicator: function (doc) {
		//	console.log(doc);
			if (doc.status === "Approved") {
				return [__("Approved"), "green", "status,=,Approved"];
			} else if (doc.status === "Rejected") {
				return [__("Rejected"), "red", "status,=,Rejected"];
			}
			else if (doc.status === "Recommended") {
				return [__("Recommended"), "yellow", "status,=,Recommended"];
			}
			else if (doc.status === "Amended") {
				return [__("Amended"), "blue", "status,=,Amended"];
			}
			else if (doc.status === "Cancelled") {
				return [__("Cancelled"), "red", "status,=,Cancelled"];
			}
			 else {
				return [__("Open"), "red", "status,=,Open"];
			}
		},
	}
}