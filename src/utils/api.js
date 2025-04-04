const API_URL = 'https://receipt-viewer.nfr-us-wwt-atc.workers.dev';

// Replace with your actual API URL from the worker deployment

export async function login(email) {
  const response = await fetch(`${API_URL}/api/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });
  
  return response.json();
}

export async function getCategories(token) {
  const response = await fetch(`${API_URL}/api/categories`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  return response.json();
}

export async function getExpenses(token, startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.append('start', startDate);
  if (endDate) params.append('end', endDate);
  
  const response = await fetch(`${API_URL}/api/expenses?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  return response.json();
}

export async function addExpense(token, expenseData) {
  const response = await fetch(`${API_URL}/api/expenses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(expenseData),
  });
  
  return response.json();
}

export async function getSummary(token, startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.append('start', startDate);
  if (endDate) params.append('end', endDate);
  
  const response = await fetch(`${API_URL}/api/summary?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  return response.json();
}

export async function uploadReceipt(token, expenseId, file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('expenseId', expenseId);
  
  const response = await fetch(`${API_URL}/api/upload-receipt`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });
  
  return response.json();
}
