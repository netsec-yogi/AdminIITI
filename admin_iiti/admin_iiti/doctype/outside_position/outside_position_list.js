frappe.listview_settings['Outside Position'] = {
	has_indicator_for_draft: 1,
	onload: function(listview) {
        if(frappe.session.user != 'Administrator'){
            frappe.set_route('List', 'Outside Position','List');
            frappe.route_options = {
                status: '',
				employee_name: '',
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
		else if (doc.status === "Forwarded By Reporting Officer"){
            return [__("Forwarded By Reporting Officer"), "yellow", "status,=,Forwarded By OfForwarded By Reporting Officer"];
        }
		else if (doc.status === "Forwarded By Officer"){
            return [__("Forwarded By Officer"), "pink", "status,=,Forwarded By Officer"];
        }
		else if (doc.status === "Forwarded By Admin"){
            return [__("Forwarded By Admin"), "cyan", "status,=,Forwarded By Admin"];
        }
		else if (doc.status === "Forwarded By RO"){
            return [__("Forwarded By RO"), "pink", "status,=,Forwarded By RO"];
        }
		else if (doc.status === "Forwarded By DOA"){
            return [__("Forwarded By DOA"), "cyan", "status,=,Forwarded By DOA"];
        }
		else if (doc.status === "Forwarded By CVO"){
            return [__("Forwarded By CVO"), "cyan", "status,=,Forwarded By CVO"];
        }
		else if (doc.status === "Forwarded By RO"){
            return [__("Forwarded By RO"), "Blue", "status,=,Forwarded By RO"];
        }
		else if (doc.status === "Rejected"){
			return [__("Rejected"), "red", "status,=,Rejected"];
		}
        else {
			return [__("Draft"), "red", "status,=,Draft"];
		}
	},	
};