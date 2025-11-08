frappe.listview_settings['Communication Allowance'] = {
	has_indicator_for_draft: 1,
	onload: function(listview) {

        if(frappe.session.user != 'Administrator'){
            frappe.set_route('List', 'Communication Allowance','List');
            frappe.route_options = {
                status: '',
				employee: '',
				department:''
            }
        }
	},
	get_indicator: function (doc) {
		if (doc.status === "Approved") {
			return [__("Approved"), "green", "status,=,Approved"];
		} else if (doc.status === "Not Approved") {
			return [__("Not Approved"), "red", "status,=,Not Approved"];
		}else if (doc.status === "Cancelled") {
			return [__("Cancelled"), "red", "status,=,Cancelled"];
		}else if(doc.status === "Processed"){
			return [__("Processed"), "purple", "status,=,Processed"];
		}else if (doc.status === "Checked"){
			return [__("Checked"), "Blue", "status,=,Checked"];
		}else if (doc.status === "Recommended"){
			return [__("Recommended"), "yellow", "status,=,Recommended"];
		}else if (doc.status === "Open"){
            return [__("Open"), "red", "status,=,Open"];
        }
		else if (doc.status === "Rejected"){
			return [__("Rejected"), "red", "status,=,Rejected"];
		}
        else {
			return [__("Draft"), "red", "status,=,Draft"];
		}
	},	
};