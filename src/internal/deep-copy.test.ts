import { deleteIn, getIn, setIn } from "./deep-copy";
import type { Path } from "react-hook-form";

interface Sample {
  user: {
    name: string;
    address?: { city?: string; zip?: string };
    tags?: string[];
    contacts?: { type: string; value: string }[];
  };
}

describe("deep-copy helpers", () => {
  test("getIn: reads nested object and array indices", () => {
    const data: Sample = {
      user: {
        name: "John",
        address: { city: "LA", zip: "90001" },
        tags: ["a", "b"],
        contacts: [
          { type: "email", value: "john@example.com" },
          { type: "phone", value: "123" }
        ]
      }
    };

    expect(getIn(data, "user.name")).toBe("John");
    expect(getIn(data, "user.address.city")).toBe("LA");
    expect(getIn(data, "user.tags.1")).toBe("b");
    expect(getIn(data, "user.contacts.0.type")).toBe("email");

    const missingPath = "user.missing" as unknown as Path<Sample>;
    expect(getIn(data, missingPath)).toBeUndefined();
  });

  test("setIn: sets nested values and creates containers as needed", () => {
    const data = { user: { name: "Jane" } } as unknown as Sample;

    setIn(data, "user.address.city", "NY");
    expect(getIn(data, "user.address.city")).toBe("NY");

    setIn(data, "user.contacts.0.type", "email");
    setIn(data, "user.contacts.0.value", "jane@example.com");
    expect(getIn(data, "user.contacts.0.type")).toBe("email");
    expect(getIn(data, "user.contacts.0.value")).toBe("jane@example.com");

    setIn(data, "user.tags.1", "b");
    expect(getIn(data, "user.tags.1")).toBe("b");
  });

  test("deleteIn: deletes nested values and prunes empty objects", () => {
    const data: Sample = {
      user: {
        name: "John",
        address: { city: "LA", zip: "90001" },
        contacts: [{ type: "email", value: "john@example.com" }]
      }
    };

    const emptyAfterDelete = deleteIn(data, "user.address.city");
    expect(emptyAfterDelete).toBe(false);
    expect(getIn(data, "user.address.city")).toBeUndefined();

    deleteIn(data, "user.address.zip");
    expect(getIn(data, "user.address")).toBeUndefined();

    deleteIn(data, "user.contacts.0.type");
    expect(getIn(data, "user.contacts.0.type")).toBeUndefined();
  });
});
