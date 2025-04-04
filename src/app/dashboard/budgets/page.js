'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
// Add budget API functions to api.js
import { getBudgets, getCategories, createBudget } from '@/utils/api';

export default function BudgetsPage() {
  const { token } = useAuth();
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // New budget form
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    categoryId: '',
    amount: '',
    period: 'monthly'
  });
  const [submitting, setSubmitting] = useState(false);
  
  // Load data
  useEffect(() => {
    async function loadData() {
      if (!token) return;
      
      setLoading(true);
      
      try {
        // Get budgets
        const budgetsResult = await getBudgets(token);
        if (budgetsResult.budgets) {
          setBudgets(budgetsResult.budgets);
        }
        
        // Get categories
        const categoriesResult = await getCategories(token);
        if (categoriesResult.categories) {
          setCategories(categoriesResult.categories);
        }
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [token]);
  
  // Handle form input changes
  function handleInputChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }
  
  // Handle form submission
  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      // Add the budget
      const result = await createBudget(token, {
        categoryId: formData.categoryId,
        amount: parseFloat(formData.amount),
        period: formData.period
      });
      
      if (result.success) {
        // Reset form
        setFormData({
          categoryId: '',
          amount: '',
          period: 'monthly'
        });
        setShowForm(false);
        
        // Reload budgets
        const budgetsResult = await getBudgets(token);
        if (budgetsResult.budgets) {
          setBudgets(budgetsResult.budgets);
        }
      }
    } catch (err) {
      console.error('Error adding budget:', err);
      setError('Failed to add budget. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Budgets</h1>
        <button
          onClick={() => setShowForm(prev => !prev)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : 'Add Budget'}
        </button>
      </div>
      
      {/* New budget form */}
      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">New Budget</h2>
          
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  name="categoryId"
                  value={formData.categoryId}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
                <select
                  name="period"
                  value={formData.period}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>
            
            <div className="mt-4">
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-300"
              >
                {submitting ? 'Adding...' : 'Add Budget'}
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* Budgets list */}
      {loading ? (
        <div className="text-center py-8">Loading budgets...</div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      ) : budgets.length === 0 ? (
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <p className="text-gray-500">No budgets found. Create one to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgets.map(budget => (
            <div key={budget.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div 
                className="h-2" 
                style={{ backgroundColor: budget.category_color || '#ccc' }}
              ></div>
              <div className="p-4">
                <h3 className="font-semibold text-lg">{budget.category_name}</h3>
                <p className="text-gray-500 capitalize">{budget.period} Budget</p>
                
                <div className="mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">
                      ${budget.current_spent?.toFixed(2) || '0.00'} of ${budget.amount.toFixed(2)}
                    </span>
                    <span className="text-sm font-medium">
                      {budget.percentage_used || 0}%
                    </span>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                    <div 
                      className={`h-2.5 rounded-full ${
                        (budget.percentage_used || 0) > 85 ? 'bg-red-600' : 'bg-green-600'
                      }`}
                      style={{ width: `${Math.min(budget.percentage_used || 0, 100)}%` }}
                    ></div>
                  </div>
                  
                  <p className="mt-2 text-sm">
                    Remaining: <span className="font-medium">${budget.remaining?.toFixed(2) || budget.amount.toFixed(2)}</span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
