import { describe, expect, it } from "vitest";
import { heuristicExtract } from "../heuristicExtractor.js";

describe("heuristicExtract", () => {
  it("maps messy lead fields into CRM records", () => {
    const result = heuristicExtract([
      {
        "Lead Created": "2026-05-13 14:20:48",
        "Customer Name": "John Doe",
        "Primary Email": "john.doe@example.com",
        "Contact Number": "+91 9876543210",
        "Company / Business": "GrowEasy",
        "City Name": "Mumbai",
        "State / Region": "Maharashtra",
        Country: "India",
        "Assigned Sales Owner": "test@gmail.com",
        "Current Stage": "good lead follow up",
        Remarks: "Client is asking to reschedule demo",
        "Campaign / Property Source": "leads_on_demand"
      }
    ]);

    expect(result.skipped).toHaveLength(0);
    expect(result.records[0]).toMatchObject({
      name: "John Doe",
      email: "john.doe@example.com",
      country_code: "+91",
      mobile_without_country_code: "9876543210",
      company: "GrowEasy",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      lead_owner: "test@gmail.com",
      crm_status: "GOOD_LEAD_FOLLOW_UP",
      crm_note: "Client is asking to reschedule demo",
      data_source: "leads_on_demand"
    });
  });

  it("keeps first contact value and moves extra contacts into notes", () => {
    const result = heuristicExtract([
      {
        "Full Name": "Priya Singh",
        "Email Address": "priya@example.com, priya.alt@example.com",
        Phone: "+91 9876543213 / +91 9999988888",
        Notes: "Deal closed",
        Status: "sale done"
      }
    ]);

    expect(result.records[0]).toMatchObject({
      email: "priya@example.com",
      country_code: "+91",
      mobile_without_country_code: "9876543213",
      crm_status: "SALE_DONE"
    });
    expect(result.records[0]?.crm_note).toContain("Extra email: priya.alt@example.com");
    expect(result.records[0]?.crm_note).toContain("Extra phone: +91 9999988888");
  });

  it("skips rows without an email or mobile number", () => {
    const result = heuristicExtract([
      {
        Name: "Unknown",
        Remarks: "No contact details"
      }
    ]);

    expect(result.records).toHaveLength(0);
    expect(result.skipped).toEqual([
      {
        rowNumber: 1,
        reason: "Missing both email and mobile number",
        original: {
          Name: "Unknown",
          Remarks: "No contact details"
        }
      }
    ]);
  });
});
