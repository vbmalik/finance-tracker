export default {
  async fetch(request, env) {
    return new Response("Queue worker running");
  },
  
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        const data = JSON.parse(message.body);
        
        // Handle different job types
        if (data.type === 'GENERATE_MONTHLY_REPORT') {
          await generateMonthlyReport(data.userId, env);
        } else if (data.type === 'RECALCULATE_BUDGET') {
          await recalculateBudget(data.userId, env);
        }
      } catch (error) {
        console.error('Error processing queue message:', error);
      }
    }
    
    return batch.ackAll();
  }
};

async function generateMonthlyReport(userId, env) {
  // Get user's expenses for the last month
  const now = new Date();
  const lastMonth = new Date();
  lastMonth.setMonth(now.getMonth() - 1);
  
  const startDate = lastMonth.toISOString().split('T')[0];
  const endDate = now.toISOString().split('T')[0];
  
  // Query expenses
  const { results: expenses } = await env.DB.prepare(`
    SELECT 
      e.*,
      c.name as category_name
    FROM expenses e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE e.user_id = ?
    AND e.date BETWEEN ? AND ?
  `).bind(userId, startDate, endDate).all();
  
  // Calculate total spending
  const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  
  // Group by category
  const categories = {};
  expenses.forEach(exp => {
    const catName = exp.category_name || 'Uncategorized';
    if (!categories[catName]) {
      categories[catName] = 0;
    }
    categories[catName] += exp.amount;
  });
  
  // Generate report content
  const reportContent = {
    userId,
    period: `${lastMonth.toLocaleDateString()} - ${now.toLocaleDateString()}`,
    totalSpent,
    categories: Object.entries(categories).map(([name, amount]) => ({
      name,
      amount,
      percentage: (amount / totalSpent * 100).toFixed(1)
    })),
    generatedAt: new Date().toISOString()
  };
  
  // Store report in database
  const reportId = 'report-' + Date.now();
  await env.DB.prepare(`
    INSERT INTO reports (id, user_id, content, generated_at)
    VALUES (?, ?, ?, ?)
  `).bind(
    reportId, 
    userId, 
    JSON.stringify(reportContent),
    new Date().toISOString()
  ).run();
  
  console.log(`Generated report ${reportId} for user ${userId}`);
}

async function recalculateBudget(userId, env) {
  // Get user's budgets
  const { results: budgets } = await env.DB.prepare(`
    SELECT * FROM budgets WHERE user_id = ?
  `).bind(userId).all();
  
  // For each budget, check current spending
  for (const budget of budgets) {
    // Determine date range based on budget period
    const now = new Date();
    let startDate;
    
    if (budget.period === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (budget.period === 'yearly') {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else {
      // Weekly
      const day = now.getDay();
      startDate = new Date(now);
      startDate.setDate(now.getDate() - day);
    }
    
    // Get actual spending for the period
    const { results } = await env.DB.prepare(`
      SELECT SUM(amount) as total
      FROM expenses 
      WHERE user_id = ?
      AND category_id = ?
      AND date >= ?
    `).bind(userId, budget.category_id, startDate.toISOString()).all();
    
    const spent = results[0]?.total || 0;
    const remaining = budget.amount - spent;
    const percentage = (spent / budget.amount * 100).toFixed(1);
    
    // Update budget status
    await env.DB.prepare(`
      UPDATE budgets
      SET current_spent = ?, remaining = ?, percentage_used = ?
      WHERE id = ?
    `).bind(spent, remaining, percentage, budget.id).run();
  }
  
  console.log(`Recalculated budgets for user ${userId}`);
}
