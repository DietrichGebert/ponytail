# Email Validation

**Task:** "Write me a Python function that validates email addresses."

Verbatim model output from a benchmark run, Claude Haiku 4.5, no-skill arm vs ponytail arm, temperature 1, source `benchmarks/output.json`. Reproduce: `npx promptfoo@latest eval -c benchmarks/promptfooconfig.yaml`.

## Without Ponytail, 75 lines of code

# Email Validation Function

Here's a practical Python function that validates email addresses:

```python
import re

def validate_email(email: str) -> bool:
    """
    Validates an email address using a regular expression.
    
    Args:
        email (str): The email address to validate
        
    Returns:
        bool: True if valid, False otherwise
    """
    # Regular expression pattern for email validation
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    
    return re.match(pattern, email) is not None


# Test cases
if __name__ == "__main__":
    test_emails = [
        "user@example.com",           # Valid
        "john.doe@company.co.uk",     # Valid
        "test+tag@domain.org",        # Valid
        "invalid.email@",             # Invalid
        "missing@domain",             # Invalid
        "@nodomain.com",              # Invalid
        "spaces in@email.com",        # Invalid
        "user@domain..com",           # Invalid (double dot)
    ]
    
    for email in test_emails:
        result = validate_email(email)
        print(f"{email:<30} -> {result}")
```

## More Robust Version (with additional checks)

```python
import re

def validate_email_advanced(email: str) -> tuple[bool, str]:
    """
    Advanced email validation with detailed feedback.
    
    Args:
        email (str): The email address to validate
        
    Returns:
        tuple: (is_valid, message)
    """
    # Basic checks
    if not email or not isinstance(email, str):
        return False, "Email must be a non-empty string"
    
    email = email.strip()
    
    if len(email) > 254:
        return False, "Email is too long (max 254 characters)"
    
    # Regular expression pattern
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    
    if not re.match(pattern, email):
        return False, "Email format is invalid"
    
    # Additional checks
    local_part, domain = email.rsplit('@', 1)
    
    if len(local_part) > 64:
        return False, "Local part is too long (max 64 characters)"
    
    if local_part.startswith('.') or local_part.endswith('.'):
        return False, "Local part cannot start or end with a dot"
    
    if '..' in email:
        return False, "Email cannot contain consecutive dots"
    
    return True, "Email is valid"


# Test the advanced version
if __name__ == "__main__":
    test_emails = [
        "user@example.com",
        "invalid..email@domain.com",
        ".invalid@domain.com",
        "user@domain",
    ]
    
    for email in test_emails:
        is_valid, message = validate_email_advanced(email)
        print(f"{email:<35} -> {is_valid:5} ({message})")
```

## Using a Third-Party Library (Recommended for Production)

```python
from email_validator import validate_email, EmailNotValidError

def validate_email_production(email: str) -> bool:
    """
    Validates email using the email_validator library.
    More reliable for production use.
    
    Install with: pip install email-validator
    """
    try:
        # Validate and normalize the email
        valid = validate_email(email)
        return True
    except EmailNotValidError:
        return False


# Usage
if __name__ == "__main__":
    print(validate_email_production("user@example.com"))  # True
    print(validate_email_production("invalid@"))          # False
```

## Comparison

| Method | Pros | Cons |
|--------|------|------|
| **Regex (Simple)** | Fast, no dependencies | Limited validation |
| **Regex (Advanced)** | More thorough | Still not RFC-compliant |
| **email-validator** | RFC-compliant, reliable | External dependency |

**Recommendation**: Use the `email-validator` library for production applications, as it properly handles RFC 5321/5322 standards. Use the simple regex version for quick scripts or when you want to avoid dependencies.

## With Ponytail, 3 lines of code

```python
import re

def is_valid_email(email: str) -> bool:
    return bool(re.match(r'^[^@]+@[^@]+\.[^@]+$', email))
```

Skipped: RFC 5322 parser, DNS MX lookup, confirmation email. Add when you actually need to reject `user+tag@sub.domain.co.uk` or catch typos, until then, this catches 99% of "oops I fat-fingered it" cases.

**75 → 3 lines of code**, same model, same prompt.
