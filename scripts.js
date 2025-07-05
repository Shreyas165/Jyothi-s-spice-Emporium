document.addEventListener('DOMContentLoaded', () => {
    updateCart();

    if (document.getElementById('cart-items')) {
        displayCartItems();
    }

    // Display order summary on order page
    if (document.getElementById('order-items')) {
        displayOrderSummary();
    }
});

let cart = JSON.parse(localStorage.getItem('cart')) || [];

function addToCart(productName, productPrice) {
    const product = cart.find(item => item.name === productName);
    if (product) {
        product.quantity += 1;
    } else {
        cart.push({ name: productName, price: productPrice, quantity: 1 });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCart();
}

function updateCart() {
    const cartItemsElement = document.getElementById('cart-items');
    if (cartItemsElement) {
        cartItemsElement.innerHTML = '';
        let total = 0;
        cart.forEach(item => {
            const li = document.createElement('li');
            li.textContent = `${item.name} - ₹${item.price.toFixed(2)} x ${item.quantity}`;
            cartItemsElement.appendChild(li);
            total += item.price * item.quantity;
        });
        document.getElementById('total').textContent = total.toFixed(2);
    }


    const cartCount = cart.reduce((count, item) => count + item.quantity, 0);
    const cartCountElement = document.getElementById('cart-count');
    if (cartCountElement) {
        cartCountElement.textContent = `Cart (${cartCount})`;
    }
}

function clearCart() {
    cart = [];
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCart();
}

function displayCartItems() {
    const cartItemsElement = document.getElementById('cart-items');
    cartItemsElement.innerHTML = '';
    let total = 0;
    cart.forEach(item => {
        const li = document.createElement('li');
        li.textContent = `${item.name} - ₹${item.price.toFixed(2)} x ${item.quantity}`;
        cartItemsElement.appendChild(li);
        total += item.price * item.quantity;
    });
    document.getElementById('total').textContent = total.toFixed(2);
}

function displayOrderSummary() {
    const orderItemsElement = document.getElementById('order-items');
    const orderTotalElement = document.getElementById('order-total');

    if (!orderItemsElement || !orderTotalElement) return;

    orderItemsElement.innerHTML = '';
    let total = 0;

    cart.forEach(item => {
        const div = document.createElement('div');
        div.style.marginBottom = '10px';
        div.style.padding = '8px';
        div.style.backgroundColor = '#f9f9f9';
        div.style.borderRadius = '4px';
        div.innerHTML = `
            <strong>${item.name}</strong><br>
            ₹${item.price.toFixed(2)} x ${item.quantity} = ₹${(item.price * item.quantity).toFixed(2)}
        `;
        orderItemsElement.appendChild(div);
        total += item.price * item.quantity;
    });

    orderTotalElement.textContent = total.toFixed(2);
}
function placeOrder() {

    window.location.href = 'order.html';
}

async function confirmOrder() {
    // Get form data
    const customerName = document.getElementById('customerName').value;
    const customerEmail = document.getElementById('customerEmail').value;
    const customerPhone = document.getElementById('customerPhone').value;
    const deliveryAddress = document.getElementById('address').value;
    const paymentConfirmed = document.getElementById('paymentConfirmed').checked;
    const transactionId = document.getElementById('transactionId').value;

    // Validate form
    if (!customerName || !customerEmail || !customerPhone || !deliveryAddress) {
        alert('Please fill in all required fields');
        return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
        alert('Please enter a valid email address');
        return;
    }

    // Validate phone number (basic validation)
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(customerPhone)) {
        alert('Please enter a valid 10-digit phone number');
        return;
    }

    // Validate payment confirmation
    if (!paymentConfirmed) {
        alert('Please confirm that you have completed the payment');
        return;
    }

    // Validate transaction ID
    if (!transactionId || transactionId.trim() === '') {
        alert('Please enter the transaction ID from your payment app');
        return;
    }

    // Disable button and show loading
    const confirmBtn = document.getElementById('confirm-btn');
    const orderStatus = document.getElementById('order-status');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Processing...';
    orderStatus.innerHTML = '<p style="color: blue;">Processing your order...</p>';

    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                customerName,
                customerEmail,
                customerPhone,
                deliveryAddress,
                orderItems: cart,
                totalAmount: parseFloat(document.getElementById('order-total').textContent),
                paymentConfirmed,
                transactionId
            })
        });

        const result = await response.json();

        if (response.ok) {
            alert('Order placed successfully! Payment confirmed.');
            // Clear cart
            cart = [];
            updateCart();
            // Redirect to home page
            window.location.href = 'Home.html';
        } else {
            // Handle specific error for duplicate transaction ID
            if (result.error && result.error.includes('transaction ID has already been used')) {
                alert('Error: ' + result.error + '\n\nPlease use a different transaction ID from your payment app.');
                // Clear the transaction ID field for the user to enter a new one
                document.getElementById('transactionId').value = '';
                document.getElementById('transactionId').focus();
            } else {
                alert('Error: ' + (result.error || 'Failed to place order'));
            }
        }
    } catch (error) {
        console.error('Error:', error);
        orderStatus.innerHTML = `<p style="color: red;">❌ Error: ${error.message}</p>`;
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm Order';
    }
}

// Mobile cart functionality
function toggleMobileCart() {
    const cart = document.getElementById('cart');
    if (cart) {
        cart.classList.toggle('open');
    }
}

// Add mobile menu toggle
function toggleMobileMenu() {
    const nav = document.querySelector('header nav ul');
    if (nav) {
        nav.classList.toggle('mobile-open');
    }
}

// Close cart when clicking outside
document.addEventListener('click', function (event) {
    const cart = document.getElementById('cart');
    const cartToggle = document.querySelector('.cart-toggle');

    if (cart && !cart.contains(event.target) && !cartToggle?.contains(event.target)) {
        cart.classList.remove('open');
    }
});

// Add mobile-friendly cart button
function addMobileCartButton() {
    const header = document.querySelector('header');
    if (header && !document.querySelector('.mobile-cart-btn')) {
        const cartBtn = document.createElement('button');
        cartBtn.className = 'mobile-cart-btn';
        cartBtn.innerHTML = '🛒 Cart';
        cartBtn.onclick = toggleMobileCart;
        cartBtn.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 1001;
            background: #333;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 5px;
            font-size: 14px;
            cursor: pointer;
            display: none;
        `;
        document.body.appendChild(cartBtn);

        // Show on mobile
        if (window.innerWidth <= 768) {
            cartBtn.style.display = 'block';
        }
    }
}

// Handle window resize
window.addEventListener('resize', function () {
    const mobileCartBtn = document.querySelector('.mobile-cart-btn');
    if (mobileCartBtn) {
        if (window.innerWidth <= 768) {
            mobileCartBtn.style.display = 'block';
        } else {
            mobileCartBtn.style.display = 'none';
        }
    }
});

// Initialize mobile features
document.addEventListener('DOMContentLoaded', function () {
    addMobileCartButton();

    // Add viewport meta tag if not present
    if (!document.querySelector('meta[name="viewport"]')) {
        const viewport = document.createElement('meta');
        viewport.name = 'viewport';
        viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        document.head.appendChild(viewport);
    }
});

