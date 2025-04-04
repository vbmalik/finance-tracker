// Import necessary modules
import { Router } from 'itty-router';

// Create a router
const router = Router();

// Define routes

// GET /api/categories - Get all categories for a user
router.get('/api/categories', async (request, env) => {
  try {
    // For now, hardcode the user ID (in a real app, get from auth)
    const userId = 'user-001';
    
    // Query the database
    const { results } = await env.DB.prepare(
      'SELECT * FROM categories WHERE user_id = ? ORDER BY name'
    ).bind(userId).all();
    
    // Return the results
    return new Response(JSON.stringify({ categories: results }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// GET /api/budgets - Get user's budgets
router.get('/api/budgets', async (request, env) => {
  try {
    const user = await authenticate(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get budgets with category info
    const { results } = await env.DB.prepare(`
      SELECT 
        b.*,
        c.name as category_name,
        c.color as category_color
      FROM budgets b
      JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
    `).bind(user.id).all();
    
    return new Response(JSON.stringify({ budgets: results }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// POST /api/budgets - Create a new budget
router.post('/api/budgets', async (request, env) => {
  try {
    const user = await authenticate(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const data = await request.json();
    const { categoryId, amount, period } = data;
    const budgetId = 'budget-' + Date.now();
    
    // Insert new budget
    await env.DB.prepare(`
      INSERT INTO budgets (id, user_id, category_id, amount, period)
      VALUES (?, ?, ?, ?, ?)
    `).bind(budgetId, user.id, categoryId, amount, period).run();
    
    // Queue budget calculation
    await env.FINANCE_QUEUE.send(JSON.stringify({
      type: 'RECALCULATE_BUDGET',
      userId: user.id
    }));
    
    return new Response(JSON.stringify({ 
      success: true,
      budget: { id: budgetId }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// GET /api/trends - Get spending trends
router.get('/api/trends', async (request, env) => {
  try {
    const user = await authenticate(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'monthly'; // daily, weekly, monthly
    const months = parseInt(searchParams.get('months') || '6');
    
    // Create date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    
    // Query Analytics Engine
    const sqlQuery = `
      SELECT 
        DATE_TRUNC('${period}', timestamp) as period,
        SUM(d1) as total_amount
      FROM finance-tracker-analytics
      WHERE blob1 = '${user.id}'
      AND timestamp BETWEEN '${startDate.toISOString()}' AND '${endDate.toISOString()}'
      GROUP BY period
      ORDER BY period ASC
    `;
    
    const results = await env.ANALYTICS.query(sqlQuery);
    
    return new Response(JSON.stringify({ trends: results }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

function TrendsChart({ data }) {
  // Format data for the chart
  const formattedData = data.map(item => ({
    period: new Date(item.period).toLocaleDateString('default', { month: 'short', year: 'numeric' }),
    amount: item.total_amount
  }));
  
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis />
          <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="amount" 
            stroke="#8884d8" 
            activeDot={{ r: 8 }} 
            name="Spending"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// GET /api/expenses - Get expenses for a user
router.get('/api/expenses', async (request, env) => {
  try {
    // Authenticate the user
    const user = await authenticate(request, env);
    if (!user) {
      return new Response(JSON.stringify({ 
        error: 'Unauthorized' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get query parameters
    const url = new URL(request.url);
    const startDate = url.searchParams.get('start') || '1970-01-01';
    const endDate = url.searchParams.get('end') || '2099-12-31';
    
    // Query the database using authenticated user ID
    const { results } = await env.DB.prepare(`
      SELECT 
        e.*,
        c.name as category_name,
        c.color as category_color
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.user_id = ?
      AND e.date BETWEEN ? AND ?
      ORDER BY e.date DESC
    `).bind(user.id, startDate, endDate).all();
    
    // Return the results
    return new Response(JSON.stringify({ expenses: results }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// POST /api/expenses - Create a new expense
router.post('/api/expenses', async (request, env) => {
  try {
    // Parse the request body
    const data = await request.json();
    const { amount, description, categoryId, date } = data;
    const userId = 'user-001';
    const expenseId = 'exp-' + Date.now();
    
    // Insert into database
   await env.DB.prepare(`
      INSERT INTO expenses (id, user_id, category_id, amount, description, date)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(expenseId, userId, categoryId, amount, description, date).run();
    
    // Return success
    return new Response(JSON.stringify({ 
      success: true, 
      expense: { id: expenseId } 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// POST /api/schedule-report - Schedule a monthly report
router.post('/api/schedule-report', async (request, env) => {
  try {
    const user = await authenticate(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Queue the report generation job
    await env.FINANCE_QUEUE.send(JSON.stringify({
      type: 'GENERATE_MONTHLY_REPORT',
      userId: user.id
    }));
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Report generation scheduled'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// GET /api/summary - Get expense summary by category
router.get('/api/summary', async (request, env) => {
  try {
    // Get query parameters
    const url = new URL(request.url);
    const startDate = url.searchParams.get('start') || '1970-01-01';
    const endDate = url.searchParams.get('end') || '2099-12-31';
    const userId = 'user-001';
    
    // Query the database
    const { results } = await env.DB.prepare(`
      SELECT 
        c.id,
        c.name,
        c.color,
        SUM(e.amount) as total
      FROM expenses e
      JOIN categories c ON e.category_id = c.id
      WHERE e.user_id = ?
      AND e.date BETWEEN ? AND ?
      GROUP BY c.id
      ORDER BY total DESC
    `).bind(userId, startDate, endDate).all();
    
    // Return the results
    return new Response(JSON.stringify({ summary: results }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Handle 404 - Route not found
// POST /api/upload-receipt - Upload a receipt image
router.post('/api/upload-receipt', async (request, env) => {
  try {
    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get('file');
    const expenseId = formData.get('expenseId');
    
    if (!file || !expenseId) {
      return new Response(JSON.stringify({ 
        error: 'File and expenseId are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Generate a unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${expenseId}.${fileExt}`;
    
    // Upload to R2
    await env.RECEIPTS.put(fileName, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      }
    });
    
    // Get a URL for the uploaded file
    const url = `https://receipt-images.finance-tracker.workers.dev/${fileName}`;
    
    // Update the expense record with the receipt URL
    await env.DB.prepare(`
      UPDATE expenses
      SET receipt_url = ?
      WHERE id = ?
    `).bind(url, expenseId).run();
    
    return new Response(JSON.stringify({ 
      success: true,
      url
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});


// Helper function to track expense analytics
async function trackExpenseAnalytics(env, expense, userId) {
  // Log the expense to Analytics Engine
  await env.ANALYTICS.writeDataPoint({
    blobs: [userId, expense.category_id || 'uncategorized', expense.description],
    doubles: [expense.amount],
    indexes: ['user_id', 'category_id', 'expense_description'],
  });
}

// Update the POST /api/expenses endpoint to track analytics
router.post('/api/expenses', async (request, env) => {
  try {
    // ... existing code ...
    
    // After successfully inserting the expense
    await trackExpenseAnalytics(env, {
      id: expenseId,
      user_id: userId,
      category_id: categoryId,
      amount: amount,
      description: description,
      date: date
    }, userId);
    
    // ... rest of the existing code ...
  } catch (error) {
    // ... existing error handling ...
  }
});

// GET /api/trends - Get spending trends
router.get('/api/trends', async (request, env) => {
  try {
    const user = await authenticate(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'monthly'; // daily, weekly, monthly
    const months = parseInt(searchParams.get('months') || '6');
    
    // Create date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    
    // Query Analytics Engine
    const sqlQuery = `
      SELECT 
        DATE_TRUNC('${period}', timestamp) as period,
        SUM(d1) as total_amount
      FROM finance-tracker-analytics
      WHERE blob1 = '${user.id}'
      AND timestamp BETWEEN '${startDate.toISOString()}' AND '${endDate.toISOString()}'
      GROUP BY period
      ORDER BY period ASC
    `;
    
    const results = await env.ANALYTICS.query(sqlQuery);
    
    return new Response(JSON.stringify({ trends: results }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

router.all('*', () => {
  return new Response('Not Found', { status: 404 });
});

// Export the fetch handler for the worker
export default {
  fetch: (request, env, ctx) => {
    return router.handle(request, env, ctx);
  }
};
