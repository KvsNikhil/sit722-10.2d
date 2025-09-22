document.addEventListener('DOMContentLoaded', () => {
  // === API bases (staging) ===
  const PRODUCT_API_BASE_URL  = 'https://sit722-staging-product-nikhil.azurewebsites.net';
  const ORDER_API_BASE_URL    = 'https://sit722-staging-order-nikhil.azurewebsites.net';
  const CUSTOMER_API_BASE_URL = 'https://sit722-staging-cust-nikhil.azurewebsites.net';

  // === DOM elements ===
  const messageBox       = document.getElementById('message-box');
  const productForm      = document.getElementById('product-form');
  const productListDiv   = document.getElementById('product-list');
  const customerForm     = document.getElementById('customer-form');
  const customerListDiv  = document.getElementById('customer-list');
  const cartItemsList    = document.getElementById('cart-items');
  const cartTotalSpan    = document.getElementById('cart-total');
  const placeOrderForm   = document.getElementById('place-order-form');
  const orderListDiv     = document.getElementById('order-list');

  // === Local state ===
  let cart = [];
  let productsCache = {};

  // === Utilities ===
  function showMessage(msg, type = 'info') {
    messageBox.textContent = msg;
    messageBox.className = `message-box ${type}`;
    messageBox.style.display = 'block';
    setTimeout(() => (messageBox.style.display = 'none'), 5000);
  }

  function formatCurrency(amount) {
    return `$${parseFloat(amount).toFixed(2)}`;
  }

  // Generic fetch helper that gracefully handles non-JSON error pages
  async function apiFetch(url, options = {}) {
    const res = await fetch(url, { ...options, mode: 'cors' });
    const ct = (res.headers.get('content-type') || '').toLowerCase();

    // Try to parse JSON when available
    if (ct.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) {
        const detail = (data && (data.detail || data.message)) || `HTTP ${res.status}`;
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
      }
      return data;
    }

    // Otherwise read text and throw a succinct error
    const text = await res.text();
    if (!res.ok) {
      const snippet = text.replace(/\s+/g, ' ').slice(0, 120);
      throw new Error(`HTTP ${res.status} ${res.statusText} – ${snippet}`);
    }
    // Some endpoints may return empty 204 with no JSON
    return text;
  }

  // === Product Service ===
  async function fetchProducts() {
    productListDiv.innerHTML = '<p>Loading products...</p>';
    try {
      const products = await apiFetch(`${PRODUCT_API_BASE_URL}/products/`);
      productListDiv.innerHTML = '';
      productsCache = {};

      if (!products.length) {
        productListDiv.innerHTML = '<p>No products available yet. Add some above!</p>';
        return;
      }

      products.forEach((product) => {
        productsCache[product.product_id] = product;
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
          <img src="${product.image_url || 'https://placehold.co/300x200/cccccc/333333?text=No+Image'}"
               alt="${product.name}"
               onerror="this.onerror=null;this.src='https://placehold.co/300x200/cccccc/333333?text=Image+Error';" />
          <h3>${product.name} (ID: ${product.product_id})</h3>
          <p>${product.description || 'No description available.'}</p>
          <p class="price">${formatCurrency(product.price)}</p>
          <p class="stock">Stock: ${product.stock_quantity}</p>
          <p><small>Created: ${new Date(product.created_at).toLocaleString()}</small></p>
          <p><small>Last Updated: ${new Date(product.updated_at).toLocaleString()}</small></p>
          <div class="upload-image-group">
            <label for="image-upload-${product.product_id}">Upload Image:</label>
            <input type="file" id="image-upload-${product.product_id}" accept="image/*" data-product-id="${product.product_id}">
            <button class="upload-btn" data-id="${product.product_id}">Upload Photo</button>
          </div>
          <div class="card-actions">
            <button class="add-to-cart-btn" data-id="${product.product_id}" data-name="${product.name}" data-price="${product.price}">Add to Cart</button>
            <button class="delete-btn" data-id="${product.product_id}">Delete</button>
          </div>
        `;
        productListDiv.appendChild(card);
      });
    } catch (err) {
      console.error('Error fetching products:', err);
      showMessage(`Failed to load products: ${err.message}`, 'error');
      productListDiv.innerHTML = '<p>Could not load products. Please check the Product Service.</p>';
    }
  }

  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('product-name').value;
    const price = parseFloat(document.getElementById('product-price').value);
    const stock_quantity = parseInt(document.getElementById('product-stock').value, 10);
    const description = document.getElementById('product-description').value;

    try {
      const added = await apiFetch(`${PRODUCT_API_BASE_URL}/products/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, price, stock_quantity, description }),
      });
      showMessage(`Product "${added.name}" added successfully! ID: ${added.product_id}`, 'success');
      productForm.reset();
      fetchProducts();
    } catch (err) {
      console.error('Error adding product:', err);
      showMessage(`Error adding product: ${err.message}`, 'error');
    }
  });

  productListDiv.addEventListener('click', async (e) => {
    // Delete product
    if (e.target.classList.contains('delete-btn')) {
      const productId = e.target.dataset.id;
      if (!confirm(`Delete product ID: ${productId}?`)) return;
      try {
        const res = await fetch(`${PRODUCT_API_BASE_URL}/products/${productId}`, { method: 'DELETE' });
        if (res.status === 204) {
          showMessage(`Product ID: ${productId} deleted.`, 'success');
          fetchProducts();
        } else {
          await apiFetch(`${PRODUCT_API_BASE_URL}/products/${productId}`, { method: 'DELETE' }); // will throw
        }
      } catch (err) {
        console.error('Error deleting product:', err);
        showMessage(`Error deleting product: ${err.message}`, 'error');
      }
    }

    // Add to cart
    if (e.target.classList.contains('add-to-cart-btn')) {
      const productId = e.target.dataset.id;
      const productName = e.target.dataset.name;
      const productPrice = parseFloat(e.target.dataset.price);
      addToCart(productId, productName, productPrice);
    }

    // Upload image
    if (e.target.classList.contains('upload-btn')) {
      const productId = e.target.dataset.id;
      const fileInput = document.getElementById(`image-upload-${productId}`);
      const file = fileInput.files[0];
      if (!file) return showMessage('Please select an image file to upload.', 'info');

      const formData = new FormData();
      formData.append('file', file);

      try {
        showMessage(`Uploading image for product ${productId}...`, 'info');
        const res = await fetch(`${PRODUCT_API_BASE_URL}/products/${productId}/upload-image`, {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) {
          // route through helper to surface any JSON error
          await apiFetch(`${PRODUCT_API_BASE_URL}/products/${productId}/upload-image`, {
            method: 'POST',
            body: formData,
          });
        } else {
          const updated = await res.json();
          showMessage(`Image uploaded for product ${updated.name}!`, 'success');
          fileInput.value = '';
          fetchProducts();
        }
      } catch (err) {
        console.error('Error uploading image:', err);
        showMessage(`Error uploading image: ${err.message}`, 'error');
      }
    }
  });

  // === Cart ===
  function addToCart(productId, productName, productPrice) {
    const idx = cart.findIndex((i) => i.product_id === productId);
    if (idx !== -1) cart[idx].quantity += 1;
    else cart.push({ product_id: productId, name: productName, price: productPrice, quantity: 1 });
    updateCartDisplay();
    showMessage(`Added "${productName}" to cart!`, 'info');
  }

  function updateCartDisplay() {
    cartItemsList.innerHTML = '';
    let total = 0;
    if (!cart.length) {
      cartItemsList.innerHTML = '<li>Your cart is empty.</li>';
    } else {
      cart.forEach((item) => {
        const li = document.createElement('li');
        const itemTotal = item.quantity * item.price;
        total += itemTotal;
        li.innerHTML = `
          <span>${item.name} (x${item.quantity})</span>
          <span>${formatCurrency(item.price)} each - ${formatCurrency(itemTotal)}</span>
        `;
        cartItemsList.appendChild(li);
      });
    }
    cartTotalSpan.textContent = `Total: ${formatCurrency(total)}`;
  }

  // === Customer Service ===
  async function fetchCustomers() {
    customerListDiv.innerHTML = '<p>Loading customers...</p>';
    try {
      const customers = await apiFetch(`${CUSTOMER_API_BASE_URL}/customers/`);
      customerListDiv.innerHTML = '';

      if (!customers.length) {
        customerListDiv.innerHTML = '<p>No customers available yet. Add some above!</p>';
        return;
      }

      customers.forEach((c) => {
        const card = document.createElement('div');
        card.className = 'customer-card';
        card.innerHTML = `
          <h3>${c.first_name} ${c.last_name} (ID: ${c.customer_id})</h3>
          <p>Email: ${c.email}</p>
          <p>Phone: ${c.phone_number || 'N/A'}</p>
          <p>Shipping Address: ${c.shipping_address || 'N/A'}</p>
          <p><small>Created: ${new Date(c.created_at).toLocaleString()}</small></p>
          <div class="card-actions">
            <button class="delete-customer-btn" data-id="${c.customer_id}">Delete</button>
          </div>
        `;
        customerListDiv.appendChild(card);
      });
    } catch (err) {
      console.error('Error fetching customers:', err);
      showMessage(`Failed to load customers: ${err.message}`, 'error');
      customerListDiv.innerHTML = '<p>Could not load customers. Please check the Customer Service.</p>';
    }
  }

  customerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email            = document.getElementById('customer-email').value;
    const password         = document.getElementById('customer-password').value;
    const first_name       = document.getElementById('customer-first-name').value;
    const last_name        = document.getElementById('customer-last-name').value;
    const phone_number     = document.getElementById('customer-phone').value;
    const shipping_address = document.getElementById('customer-shipping-address').value;

    try {
      const added = await apiFetch(`${CUSTOMER_API_BASE_URL}/customers/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, first_name, last_name, phone_number, shipping_address }),
      });
      showMessage(`Customer "${added.email}" added! ID: ${added.customer_id}`, 'success');
      customerForm.reset();
      fetchCustomers();
    } catch (err) {
      console.error('Error adding customer:', err);
      showMessage(`Error adding customer: ${err.message}`, 'error');
    }
  });

  customerListDiv.addEventListener('click', async (e) => {
    if (!e.target.classList.contains('delete-customer-btn')) return;
    const id = e.target.dataset.id;
    if (!confirm(`Delete customer ID: ${id}?`)) return;
    try {
      const res = await fetch(`${CUSTOMER_API_BASE_URL}/customers/${id}`, { method: 'DELETE' });
      if (res.status === 204) {
        showMessage(`Customer ID: ${id} deleted.`, 'success');
        fetchCustomers();
      } else {
        await apiFetch(`${CUSTOMER_API_BASE_URL}/customers/${id}`, { method: 'DELETE' }); // will throw
      }
    } catch (err) {
      console.error('Error deleting customer:', err);
      showMessage(`Error deleting customer: ${err.message}`, 'error');
    }
  });

  // === Order Service ===
  placeOrderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!cart.length) return showMessage('Your cart is empty. Add products first.', 'info');

    const user_id         = parseInt(document.getElementById('order-user-id').value, 10);
    const shipping_address = document.getElementById('shipping-address').value;
    const items = cart.map((i) => ({
      product_id: parseInt(i.product_id, 10),
      quantity: i.quantity,
      price_at_purchase: i.price,
    }));

    try {
      showMessage('Placing order... (status will update asynchronously)', 'info');
      const placed = await apiFetch(`${ORDER_API_BASE_URL}/orders/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id, shipping_address, items }),
      });
      showMessage(`Order ${placed.order_id} created with status: ${placed.status}.`, 'success');
      cart = [];
      updateCartDisplay();
      placeOrderForm.reset();
      fetchOrders();
    } catch (err) {
      console.error('Error placing order:', err);
      showMessage(`Error placing order: ${err.message}`, 'error');
    }
  });

  async function fetchOrders() {
    orderListDiv.innerHTML = '<p>Loading orders...</p>';
    try {
      const orders = await apiFetch(`${ORDER_API_BASE_URL}/orders/`);
      orderListDiv.innerHTML = '';

      if (!orders.length) {
        orderListDiv.innerHTML = '<p>No orders available yet.</p>';
        return;
      }

      orders.forEach((order) => {
        const card = document.createElement('div');
        card.className = 'order-card';
        card.innerHTML = `
          <h3>Order ID: ${order.order_id}</h3>
          <p>User ID: ${order.user_id}</p>
          <p>Order Date: ${new Date(order.order_date).toLocaleString()}</p>
          <p>Status: <span id="order-status-${order.order_id}">${order.status}</span></p>
          <p>Total Amount: ${formatCurrency(order.total_amount)}</p>
          <p>Shipping Address: ${order.shipping_address || 'N/A'}</p>
          <p><small>Created: ${new Date(order.created_at).toLocaleString()}</small></p>
          <p><small>Last Updated: ${new Date(order.updated_at).toLocaleString()}</small></p>

          <h4>Items:</h4>
          <ul class="order-items">
            ${order.items.map((it) => `
              <li>
                <span>Product ID: ${it.product_id}</span>
                - Qty: ${it.quantity} @ ${formatCurrency(it.price_at_purchase)}
                (Total: ${formatCurrency(it.item_total)})
              </li>
            `).join('')}
          </ul>

          <div class="status-selector">
            <select id="status-select-${order.order_id}" data-order-id="${order.order_id}">
              <option value="pending"   ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="processing"${order.status === 'processing' ? 'selected' : ''}>Processing</option>
              <option value="shipped"   ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
              <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
              <option value="failed"    ${order.status === 'failed' ? 'selected' : ''}>Failed</option>
              <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
              <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Completed</option>
            </select>
            <button class="status-update-btn" data-id="${order.order_id}">Update Status</button>
          </div>
          <div class="card-actions">
            <button class="delete-btn" data-id="${order.order_id}">Delete Order</button>
          </div>
        `;
        orderListDiv.appendChild(card);
      });
    } catch (err) {
      console.error('Error fetching orders:', err);
      showMessage(`Failed to load orders: ${err.message}`, 'error');
      orderListDiv.innerHTML = '<p>Could not load orders. Please check the Order Service.</p>';
    }
  }

  orderListDiv.addEventListener('click', async (e) => {
    // Update status
    if (e.target.classList.contains('status-update-btn')) {
      const orderId = e.target.dataset.id;
      const select = document.getElementById(`status-select-${orderId}`);
      const newStatus = select.value;

      try {
        showMessage(`Updating status for order ${orderId} to "${newStatus}"...`, 'info');
        const updated = await apiFetch(`${ORDER_API_BASE_URL}/orders/${orderId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });
        document.getElementById(`order-status-${orderId}`).textContent = updated.status;
        showMessage(`Order ${orderId} status updated to "${updated.status}"!`, 'success');
        fetchOrders();
      } catch (err) {
        console.error('Error updating order status:', err);
        showMessage(`Error updating order status: ${err.message}`, 'error');
      }
    }

    // Delete order
    if (e.target.classList.contains('delete-btn')) {
      const orderId = e.target.dataset.id;
      if (!confirm(`Delete order ID: ${orderId}? This will also delete all associated items.`)) return;
      try {
        const res = await fetch(`${ORDER_API_BASE_URL}/orders/${orderId}`, { method: 'DELETE' });
        if (res.status === 204) {
          showMessage(`Order ID: ${orderId} deleted.`, 'success');
          fetchOrders();
        } else {
          await apiFetch(`${ORDER_API_BASE_URL}/orders/${orderId}`, { method: 'DELETE' }); // will throw
        }
      } catch (err) {
        console.error('Error deleting order:', err);
        showMessage(`Error deleting order: ${err.message}`, 'error');
      }
    }
  });

  // === Initial load + periodic refresh ===
  fetchProducts();
  fetchCustomers();
  fetchOrders();
  setInterval(fetchOrders, 10000);
  setInterval(fetchProducts, 15000);
});
