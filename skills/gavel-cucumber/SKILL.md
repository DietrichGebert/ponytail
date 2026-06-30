---
name: gavel-cucumber
description: >
  Cucumber/BDD framework profile for gavel. Provides Gherkin patterns for
  Cucumber-JVM, Cucumber.js, Behave (Python), and SpecFlow (C#). Covers feature
  files, step definitions, Scenario Outline, tags, data tables, hooks.
  Activated automatically by gavel-detect when .feature files are found.
---

# Gavel Cucumber/BDD Profile

Cucumber-specific patterns that supplement the universal Test Constitution.

## Feature File Structure

```gherkin
@sanity @regression
Feature: Admin Dashboard
  As an admin user
  I want to view the dashboard
  So that I can monitor system metrics

  Background:
    Given I am logged in as an admin

  Scenario: Dashboard loads with metrics
    When I navigate to the dashboard
    Then I should see the metrics card
    And the metrics card should display current data

  Scenario Outline: Dashboard filters by date range
    When I navigate to the dashboard
    And I select the "<range>" date filter
    Then the metrics should show "<expected>" data

    Examples:
      | range   | expected  |
      | Today   | today     |
      | Week    | this week |
      | Month   | this month|
```

## Step Definitions

### Cucumber.js (JavaScript)

```javascript
const { Given, When, Then } = require('@cucumber/cucumber');

Given('I am logged in as an admin', async function() {
  this.adminPage = await AdminPage.create(this.driver);
  await this.adminPage.login();
});

When('I navigate to the dashboard', async function() {
  await this.adminPage.navigateToDashboard();
});

Then('I should see the metrics card', async function() {
  await expect(this.adminPage.locators.metricsCard).toBeDisplayed();
});
```

### Behave (Python)

```python
from behave import given, when, then

@given('I am logged in as an admin')
def step_login_admin(context):
    context.admin_page = AdminPage(context.driver)
    context.admin_page.login()

@when('I navigate to the dashboard')
def step_navigate_dashboard(context):
    context.admin_page.navigate_to_dashboard()

@then('I should see the metrics card')
def step_see_metrics(context):
    assert context.admin_page.is_metrics_visible()
```

### Cucumber-JVM (Java)

```java
public class DashboardSteps {
    private AdminPage adminPage;

    @Given("I am logged in as an admin")
    public void loginAdmin() {
        adminPage = new AdminPage(DriverFactory.getDriver());
        adminPage.login();
    }

    @When("I navigate to the dashboard")
    public void navigateToDashboard() {
        adminPage.navigateToDashboard();
    }

    @Then("I should see the metrics card")
    public void seeMetricsCard() {
        assertTrue(adminPage.isMetricsVisible());
    }
}
```

## Tag Management

| Tag | Purpose |
|-----|---------|
| `@smoke` | Fastest critical-path checks |
| `@sanity` | Important feature verification |
| `@regression` | Broader coverage |
| `@wip` | Work in progress (exclude from CI) |
| `@bug-XXX` | Linked to known bug |

## Hooks

```javascript
// Before/After hooks for setup/teardown
Before({ tags: '@sanity' }, async function() {
  this.driver = await createDriver();
});

After(async function() {
  await this.driver?.quit();
});

// Idempotent cleanup
After(async function() {
  try { await this.apiClient?.deleteTestUser(); } catch { /* already deleted */ }
});
```

## Data Tables

```gherkin
Then the user list should contain:
  | name     | role    | status  |
  | Alice    | admin   | active  |
  | Bob      | viewer  | active  |
```

```javascript
Then('the user list should contain:', async function(dataTable) {
  const rows = dataTable.hashes();
  for (const row of rows) {
    await expect(this.page.getUserRow(row.name)).toContainText(row.role);
  }
});
```

## Run Commands

```bash
# Cucumber.js
npx cucumber-js --tags "@sanity"

# Behave (Python)
behave --tags=@sanity features/

# Cucumber-JVM
mvn test -Dcucumber.filter.tags="@sanity"
```
