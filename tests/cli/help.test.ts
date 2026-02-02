import { jest } from "@jest/globals";
import { printHelp } from "../../src/cli/utils/help.js";

describe("printHelp", () => {
  it("deve imprimir o texto de ajuda no console", () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    printHelp();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("docs-kit - Intelligent documentation agent"),
    );

    consoleSpy.mockRestore();
  });
});
