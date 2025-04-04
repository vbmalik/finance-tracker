'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getSummary, getExpenses } from '@/utils/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export default function DashboardPage() {
  const { token } = useAuth();
  const [summary, setSummary] = useState([]);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeframe, setTimeframe] = useState('month'); // 'month', 'year', 'all'

  // Get the date range based on timeframe
  function getDateRange() {
    const now = new Date();
    let startDate = new Date();
    
    if (timeframe === 'month') {
      startDate.setMonth(now.getMonth() - 1);
    } else if (timeframe === 'year') {
      startDate.setFullYear(now.getFullYear() - 1);
    } else {
      // All time - use a very old date
      startDate = new Date(2000, 0, 1);
    }
    
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0]
    };
  }

  // Load data
  useEffect(() => {
    async function loadData() {
      if (!token) return;
      
      setLoading(true);
      const { startDate, endDate } = getDateRange();
      
      try {
        // Get summary data
        const summaryResult = await getSummary(token, startDate, endDate);
        if (summaryResult.summary) {
          setSummary(summaryResult.summary);
        }
        
        // Get recent expenses
        const expensesResult = await getExpenses(token, startDate, endDate);
        if (expensesResult.expenses) {
          // Sort by date (newest first) and take the 5 most recent
          const sorted = [...expensesResult.expenses]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);
          setRecentExpenses(sorted);
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [token, timeframe]);

  // Calculate total spending
  const totalSpending = summary.reduce((sum, item) => sum + item.total, 0);

  // Pie chart colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      
      {/* Timeframe selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Timeframe</label>
        <div className="flex space-x-4">
          <button
            onClick={() => setTimeframe('month')}
            className={`px-4 py-2 rounded-md ${
              timeframe === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
            }`}
          >
            Last Month
          </button>
          <button
            onClick={() => setTimeframe('year')}
            className={`px-4 py-2 rounded-md ${
              timeframe === 'year' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
            }`}
          >
            Last Year
          </button>
          <button
            onClick={() => setTimeframe('all')}
            className={`px-4 py-2 rounded-md ${
              timeframe === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'
            }`}
          >
            All Time
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="text-center py-8">Loading data...</div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Spending Summary */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Spending Summary</h2>
            <p className="text-3xl font-bold mb-4">${totalSpending.toFixed(2)}</p>
            
            {summary.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summary}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="total"
                      nameKey="name"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {summary.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No spending data for this period</p>
            )}
          </div>
          
          {/* Recent Expenses */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Recent Expenses</h2>
            
            {recentExpenses.length > 0 ? (
              <div className="space-y-4">
                {recentExpenses.map((expense) => (
                  <div key={expense.id} className="flex justify-between items-center border-b pb-2">
                    <div>
                      <p className="font-medium">{expense.description}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(expense.date).toLocaleDateString()} • {expense.category_name}
                      </p>
                    </div>
                    <p className="font-semibold">${expense.amount.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No recent expenses</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
