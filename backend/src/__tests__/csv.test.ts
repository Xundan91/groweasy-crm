import { describe, expect, it } from "vitest";
import { parseCsv } from "../csv.js";

describe("parseCsv", () => {
  it("parses valid CSV rows with trimmed headers and values", () => {
    const csv = Buffer.from(
      " Full Name , Email Address , Phone \n John Doe , john@example.com , +91 9876543210 \n"
    );

    expect(parseCsv(csv)).toEqual([
      {
        "Full Name": "John Doe",
        "Email Address": "john@example.com",
        Phone: "+91 9876543210"
      }
    ]);
  });
});
