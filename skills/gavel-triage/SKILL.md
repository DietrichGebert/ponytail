---
name: gavel-triage
description: >
  Navigation guide for locating the exact source-code culprit behind a test
  failure. Framework-adaptive: Django, Express, Spring, FastAPI, etc. Use when
  you need to point a developer to the specific file, function, and line range
  responsible for a bug, feeding into gavel-bug.
---

# Gavel Triage

Backend code triage for test failures. Framework-adaptive.

## When to Use

- An API test has failed with a confirmed product bug
- You need to locate the source code responsible before writing a bug report
- A developer asks "where does this endpoint's logic live?"

## General Layer Map (Adapt to Your Stack)

### Django/DRF
```
app/<domain>/urls.py -> views.py -> serializers.py -> services/ -> models.py
```

### Express/Node
```
routes/<domain>.js -> controllers/ -> services/ -> models/
```

### Spring Boot
```
controller/ -> service/ -> repository/ -> entity/
```

### FastAPI
```
routers/<domain>.py -> services/ -> models/ -> schemas.py
```

## Triage Flow

1. **Start from the failing assertion** -- extract the response field or endpoint
2. **Locate the route/endpoint** -- grep urls/routes for the path
3. **Follow the controller/view** -- find the handler method
4. **Follow the serializer/schema** -- if the failing field is a response key
5. **Descend into the service** -- business logic usually lives here
6. **Capture coordinates** -- exact file, function, line numbers

## Output Format

Each cited location MUST be a markdown link:
```markdown
[function_name](file:///absolute/path/to/file#L<start>-L<end>)
```

## Anti-Patterns

- Stopping at the controller when the bug is in the service
- Citing line numbers without reading the file
- Providing "likely location" without opening the file
