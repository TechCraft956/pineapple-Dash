# Pineapple OS — Pseudocode & Core Logic

## Command Center — Entry Creation Flow

```
FUNCTION createCommand(content, entryType, tags):
    // Validate
    IF content is empty: RETURN error

    // Build document
    doc = {
        id: generateUUID(),
        content: content,
        entry_type: entryType,  // task|deal|note|idea|trade|system
        tags: tags,
        created_at: currentTimestampISO()
    }

    // Persist
    INSERT doc INTO commands collection

    // Track
    LOG activity("created", "commands", doc.id, content.substring(0, 80))

    RETURN doc
```

## Deal — Auto Calculation Logic

```
FUNCTION calculateDealMetrics(buyPrice, sellPrice, fees):
    estimatedProfit = sellPrice - buyPrice - fees
    roiPercent = IF buyPrice > 0 THEN (estimatedProfit / buyPrice) * 100 ELSE 0

    RETURN {
        estimated_profit: ROUND(estimatedProfit, 2),
        roi_percent: ROUND(roiPercent, 2)
    }

FUNCTION createDeal(data):
    doc = {
        ...data,
        id: generateUUID(),
        created_at: NOW(),
        updated_at: NOW()
    }

    // Auto-calculate
    metrics = calculateDealMetrics(doc.buy_price, doc.sell_price, doc.fees)
    doc.estimated_profit = metrics.estimated_profit
    doc.roi_percent = metrics.roi_percent

    INSERT doc INTO deals collection
    LOG activity("created", "deals", doc.id, doc.title)

    RETURN doc

FUNCTION updateDeal(dealId, updates):
    // If prices changed, recalculate
    IF updates contains any of (buy_price, sell_price, fees):
        currentDeal = FIND deal WHERE id = dealId
        mergedDoc = MERGE(currentDeal, updates)
        metrics = calculateDealMetrics(mergedDoc.buy_price, mergedDoc.sell_price, mergedDoc.fees)
        updates.estimated_profit = metrics.estimated_profit
        updates.roi_percent = metrics.roi_percent

    updates.updated_at = NOW()
    UPDATE deal WHERE id = dealId SET updates
```

## Dashboard — Aggregation Logic

```
FUNCTION getDashboard():
    // Parallel queries for counts
    taskCounts = {
        total: COUNT tasks,
        todo: COUNT tasks WHERE status = "todo",
        doing: COUNT tasks WHERE status = "doing",
        blocked: COUNT tasks WHERE status = "blocked",
        done: COUNT tasks WHERE status = "done"
    }

    dealCounts = {
        total: COUNT deals,
        open: COUNT deals WHERE status = "open",
        pending: COUNT deals WHERE status = "pending",
        closed: COUNT deals WHERE status = "closed"
    }

    knowledgeCount = COUNT knowledge
    buildQueueCount = COUNT build_queue WHERE status != "done"

    // Recent activity (last 15)
    recentActivity = FIND activity_log ORDER BY timestamp DESC LIMIT 15

    // Priority items
    priorityTasks = FIND tasks
        WHERE priority IN ("high", "critical") AND status != "done"
        ORDER BY created_at DESC LIMIT 10

    priorityDeals = FIND deals
        WHERE priority IN ("high", "critical") AND status IN ("open", "pending")
        ORDER BY created_at DESC LIMIT 10

    // Today's count
    todayStart = TODAY at 00:00:00 UTC
    todayEnd = TODAY at 23:59:59 UTC
    todayCount = COUNT activity_log WHERE timestamp BETWEEN todayStart AND todayEnd

    RETURN all aggregated data
```

## Daily Review — Timeline Logic

```
FUNCTION getDailyReview():
    todayDate = FORMAT(NOW(), "YYYY-MM-DD")
    todayStart = todayDate + "T00:00:00Z"
    todayEnd = todayDate + "T23:59:59Z"

    // Get all activities from today
    activities = FIND activity_log
        WHERE timestamp BETWEEN todayStart AND todayEnd
        ORDER BY timestamp DESC

    // Get saved review for today
    review = FIND daily_reviews WHERE date = todayDate

    // Count entries per module created today
    summary = {}
    FOR EACH module IN [commands, tasks, deals, knowledge, build_queue]:
        summary[module] = COUNT module WHERE created_at BETWEEN todayStart AND todayEnd

    RETURN {
        date: todayDate,
        activities: activities,
        summary: summary,
        next_actions: review.next_actions OR "",
        reflections: review.reflections OR ""
    }

FUNCTION saveDailyReview(nextActions, reflections):
    todayDate = FORMAT(NOW(), "YYYY-MM-DD")
    UPSERT daily_reviews
        WHERE date = todayDate
        SET next_actions = nextActions, reflections = reflections, updated_at = NOW()
```

## Activity Logging — Cross-Module Pattern

```
FUNCTION logActivity(action, module, entityId, title):
    // Called after every create, update, delete across all modules
    doc = {
        id: generateUUID(),
        action: action,       // "created"|"updated"|"deleted"
        module: module,       // "tasks"|"deals"|"knowledge"|etc.
        entity_id: entityId,
        title: title,
        timestamp: NOW()
    }
    INSERT doc INTO activity_log

// Usage pattern in every route:
POST /api/tasks → createTask() → logActivity("created", "tasks", task.id, task.title)
PUT /api/tasks/:id → updateTask() → logActivity("updated", "tasks", id, title)
DELETE /api/tasks/:id → deleteTask() → logActivity("deleted", "tasks", id, title)
```

## Seed Data — First Launch Logic

```
FUNCTION seedDatabase():
    existingCount = COUNT commands
    IF existingCount > 0:
        RETURN "already seeded"

    // Insert sample data for each module
    INSERT sample commands (3 entries)
    INSERT sample tasks (5 entries with varied statuses/priorities)
    INSERT sample deals (3 entries with different categories)
    INSERT sample knowledge (3 entries: SOP, reference, strategy)
    INSERT sample build_queue (3 entries at different pipeline stages)

    LOG activity("seeded", "system", "seed", "Database seeded")
    RETURN "seeded successfully"
```

## Future Extension — Adding a New Module

```
// 1. Define Pydantic models
class NewModuleCreate(BaseModel):
    title: str
    custom_field: str
    status: str = "active"
    priority: str = "medium"
    tags: List[str] = []

// 2. Add CRUD routes
@api_router.post("/new-module")
async def create_item(data: NewModuleCreate):
    doc = { id: newId(), ...data.dict(), created_at: NOW(), updated_at: NOW() }
    INSERT doc INTO new_module collection
    LOG activity("created", "new_module", doc.id, doc.title)
    RETURN doc

// 3. Create React page component
// 4. Add route to App.js
// 5. Add nav item to Layout.jsx
```
