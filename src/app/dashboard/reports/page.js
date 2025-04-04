'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getExpenses, getCategories } from '@/utils/api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from 'recharts';

export default function ReportsPage() {
  const { token } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Date range for reports
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3); // Last 3 months by default
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Load data
  useEffect(() => {
    async function loadData() {
      if (!token) return;
      
      setLoading(true);
      
      try {
        // Get all expenses within date range
        const expensesResult = await getExpenses(token, startDate, endDate);
        if (expensesResult.expenses) {
          setExpenses(expensesResult.expenses);
        }
        
        // Get categories
        const categoriesResult = await getCategories(token);
        if (categoriesResult.categories) {
          setCategories(categoriesResult.categories);
        }
      } catch (err) {
        console.error('Error loading report data:', err);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [token, startDate, endDate]);

  // Prepare data for charts
  const categoryData = categories.map(category => {
    const categoryExpenses = expenses.filter(exp => exp.category_id === category.id);
    const totalAmount = categoryExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    
    return {
      name: category.name,
      color: category.color,
      total: totalAmount
    };
  }).filter(cat => cat.total > 0).sort((a, b) => b.total - a.total);

  // Prepare monthly data
  const monthlyData = (() => {
    // Group expenses by month
    const monthMap = {};
    
    expenses.forEach(expense => {
      const date = new Date(expense.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthMap[monthKey]) {
        monthMap[monthKey] = {
          name: monthKey,
          total: 0
        };
      }
      
      monthMap[monthKey].total += expense.amount;
    });
    
    // Convert to array and sort by month
    return Object.values(monthMap).sort((a, b) => a.name.localeCompare(b.name));
  })();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reports</h1>
      
      {/* Date range selector */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-3
