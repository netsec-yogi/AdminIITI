
frappe.query_reports["Leave application report"] = {
  "filters": [
    {
      "fieldname": "company",
      "label": __("Company"),
      "fieldtype": "Link",
      "options": "Company",
      "default": frappe.defaults.get_user_default("Company")
    },
    {
      "fieldname": "from_date",
      "label": __("From Date"),
      "fieldtype": "Date"
    },
    {
      "fieldname": "to_date",
      "label": __("To Date"),
      "fieldtype": "Date"
    },
    {
      "fieldname": "department",
      "label": __("Department"),
      "fieldtype": "Link",
      "options": "Department"
    },
    {
      "fieldname": "employee",
      "label": __("Employee"),
      "fieldtype": "Link",
      "options": "Employee"
    },
    {
      "fieldname": "leave_type",
      "label": __("Leave Type"),
      "fieldtype": "Link",
      "options": "Leave Type"
    },
    {
      "fieldname": "status",
      "label": __("Status"),
      "fieldtype": "Select",
      "options": ["", "Open", "Recommended", "Amended", "Approved", "Rejected", "Cancelled"].join("\n")
    },
    {
      "fieldname": "group",
      "label": __("Group"),
      "fieldtype": "Link",
      "options": "Employee Grade"
    },
  ],
  "formatter": function (value, row, column, data, default_formatter) {
    value = default_formatter(value, row, column, data);
    if (column.fieldname === "leave_status" && data) {
      if (data.leave_status === "Rejected" || data.leave_status === "Cancelled") {
        value = "<span style='color:red'>" + value + "</span>";
      } else if (data.leave_status === "Approved") {
        value = "<span style='color:green'>" + value + "</span>";
      } else if (data.leave_status === "Open" || data.leave_status === "Recommended") {
        value = "<span style='color:#b36b00'>" + value + "</span>";
      }
    }
    return value;
  },
};
