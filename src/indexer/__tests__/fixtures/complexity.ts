export function classify(value: number, flags: string[]): string {
  if (value > 10 && flags.includes("admin")) {
    for (let index = 0; index < flags.length; index++) {
      if (flags[index] === "locked") {
        return "locked";
      }
    }
    return "admin";
  }

  return value > 0 ? "positive" : "negative";
}
