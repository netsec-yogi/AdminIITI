# Copyright (c) 2025, CITC IIT Indore and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class OutsidePosition(Document):
	def get_css(self):
		frappe.throw("jjjjjjjjj")
		return [
			"/assets/admin_iiti/css/admin_iiti.css"
		]
