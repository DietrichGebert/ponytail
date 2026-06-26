---
name: gavel-selenium
description: >
  Selenium WebDriver framework profile for gavel. Provides Selenium-specific
  patterns: WebDriverWait, pytest/JUnit fixtures, class-based POM, explicit waits.
  Activated automatically by gavel-detect when Selenium is detected.
---

# Gavel Selenium Profile

Selenium-specific patterns that supplement the universal Test Constitution.

## Locators (Python)

```python
# PRIORITY ORDER:
driver.find_element(By.CSS_SELECTOR, "[role='button']")  # fallback to CSS
driver.find_element(By.XPATH, "//button[@aria-label='Submit']")  # last resort
# Prefer: accessibility ID, then CSS with semantic attributes
# NEVER: absolute XPath like /html/body/div[2]/div/span
```

## Locators (Java)

```java
// PRIORITY ORDER:
driver.findElement(By.cssSelector("[role='button']"));
driver.findElement(By.xpath("//button[@aria-label='Submit']"));
// Prefer: By.id with semantic IDs, By.cssSelector with role/aria
```

## Assertions (explicit wait + assert)

```python
# Python + pytest
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

wait = WebDriverWait(driver, 10)
element = wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".success")))
assert element.is_displayed()
assert "Success" in element.text
```

```java
// Java + JUnit 5
WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
WebElement element = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector(".success")));
assertTrue(element.isDisplayed());
assertEquals("Success", element.getText());
```

## DI via Fixtures

```python
# Python + pytest
import pytest

@pytest.fixture
def admin_page(driver):
    page = AdminPage(driver)
    page.login()
    yield page

def test_dashboard(admin_page):  # injected, never AdminPage(driver) in test
    admin_page.navigate_to_dashboard()
    assert admin_page.is_metrics_visible()
```

```java
// Java + JUnit 5
@ExtendWith(AdminPageExtension.class)
class DashboardTest {
    @Test
    void showsMetrics(AdminPage adminPage) {  // injected
        adminPage.navigateToDashboard();
        assertTrue(adminPage.isMetricsVisible());
    }
}
```

## POM: Class-Based with Constructor Injection

```python
class AdminDashboardLocators:
    def __init__(self, driver):
        self.driver = driver

    @property
    def metrics_card(self):
        return self.driver.find_element(By.CSS_SELECTOR, "[data-testid='metrics']")

class AdminDashboardActions:
    def __init__(self, locators: AdminDashboardLocators):
        self.locators = locators

    def navigate_to_dashboard(self):
        self.locators.driver.get("/admin/dashboard")

class AdminDashboardPage:
    def __init__(self, driver):
        self.locators = AdminDashboardLocators(driver)
        self.actions = AdminDashboardActions(self.locators)
```

## Wait Strategy

NEVER use `time.sleep()` or `Thread.sleep()`. Always use explicit waits:
```python
WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.CSS_SELECTOR, ".btn")))
```
```java
new WebDriverWait(driver, Duration.ofSeconds(10))
    .until(ExpectedConditions.elementToBeClickable(By.cssSelector(".btn")));
```

## Run Commands

```bash
# Python
mypy . && ruff check .                          # Type + lint
pytest tests/ -v --junitxml=report.xml          # Run tests

# Java
mvn compile && mvn checkstyle:check             # Compile + lint
mvn test -Dtest=DashboardTest                   # Run specific test
```
