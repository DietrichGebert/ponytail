"""Integer report CLI; deliberately more code than the contract needs."""
import json
import sys


def parse_numbers(arguments):
    numbers = []
    for argument in arguments:
        numbers.append(int(argument, 10))
    return numbers


def make_report(numbers):
    result = {}
    result["count"] = len(numbers)
    result["total"] = sum(numbers)
    return result


def render_report(report):
    return json.dumps(report)


def main(arguments):
    try:
        numbers = parse_numbers(arguments)
    except ValueError as error:
        print(f"invalid integer: {error}", file=sys.stderr)
        return 2
    report = make_report(numbers)
    print(render_report(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
