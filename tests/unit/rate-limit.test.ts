import { describe, test, expect } from "bun:test";
import { getClientIp } from "../../src/lib/rate-limit";

describe("Rate Limiting", () => {
  describe("getClientIp", () => {
    test("extracts IP from x-forwarded-for header", () => {
      const request = new Request("http://test.com", {
        headers: {
          "x-forwarded-for": "1.2.3.4, 5.6.7.8",
        },
      });
      
      expect(getClientIp(request)).toBe("1.2.3.4");
    });

    test("extracts IP from cf-connecting-ip header", () => {
      const request = new Request("http://test.com", {
        headers: {
          "cf-connecting-ip": "9.10.11.12",
        },
      });
      
      expect(getClientIp(request)).toBe("9.10.11.12");
    });

    test("prefers cf-connecting-ip over x-forwarded-for", () => {
      const request = new Request("http://test.com", {
        headers: {
          "x-forwarded-for": "1.2.3.4",
          "cf-connecting-ip": "9.10.11.12",
        },
      });
      
      expect(getClientIp(request)).toBe("9.10.11.12");
    });

    test("returns anonymous when no headers", () => {
      const request = new Request("http://test.com");
      
      expect(getClientIp(request)).toBe("anonymous");
    });
  });
});
