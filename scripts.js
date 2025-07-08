document.addEventListener('DOMContentLoaded', () => {
    updateCart();

    if (document.getElementById('cart-items')) {
        displayCartItems();
    }

    // Display order summary on order page
    if (document.getElementById('order-items')) {
        displayOrderSummary();
    }

    // Contact form submission handler
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const country = document.getElementById('country').value.trim();
            const message = document.getElementById('message').value.trim();

            if (!name || !email || !country || !message) {
                alert('Please fill in all fields.');
                return;
            }

            try {
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, country, message })
                });
                const result = await response.json();
                if (response.ok && result.success) {
                    alert(result.message || 'Message sent successfully!');
                    contactForm.reset();
                } else {
                    alert(result.error || 'Failed to send message.');
                }
            } catch (err) {
                alert('An error occurred. Please try again later.');
            }
        });
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
        cart.forEach((item, idx) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${item.name} - ₹${item.price.toFixed(2)}</span>
                <button class="qty-btn" onclick="changeQuantity(${idx}, -1)">-</button>
                <span style="margin:0 8px;">${item.quantity}</span>
                <button class="qty-btn" onclick="changeQuantity(${idx}, 1)">+</button>
                <span style="float:right;">₹${(item.price * item.quantity).toFixed(2)}</span>
            `;
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
    // Update product quantity badges on product list page
    const productNames = [
        'Rasam Powder',
        'Vangibath Powder',
        'Sambar Powder',
        'Kashaya Powder',
        'Chutney Powder'
    ];
    productNames.forEach(name => {
        const badge = document.getElementById(`qty-${name}`);
        if (badge) {
            const item = cart.find(i => i.name === name);
            badge.textContent = item ? item.quantity : '';
        }
    });
}

function changeQuantity(idx, delta) {
    if (cart[idx]) {
        cart[idx].quantity += delta;
        if (cart[idx].quantity <= 0) {
            cart.splice(idx, 1); // Remove item if quantity is 0 or less
        }
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCart();
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
    cart.forEach((item, idx) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="cart-item-row">
                <span class="cart-item-name">${item.name}</span>
                <span class="cart-item-price">₹${item.price.toFixed(2)}</span>
            </div>
            <div class="cart-item-controls-row" style="display:flex;flex-direction:row;justify-content:center;align-items:center;gap:16px;width:100%">
                <button class="qty-btn" data-idx="${idx}" data-delta="-1">-</button>
                <span class="cart-item-qty" id="cart-qty-${idx}">${item.quantity}</span>
                <button class="qty-btn" data-idx="${idx}" data-delta="1">+</button>
                <span class="cart-item-total" id="cart-total-${idx}">₹${(item.price * item.quantity).toFixed(2)}</span>
            </div>
        `;
        cartItemsElement.appendChild(li);
        total += item.price * item.quantity;
    });
    document.getElementById('total').textContent = total.toFixed(2);
    // Attach event listeners for all qty-btns
    document.querySelectorAll('.qty-btn').forEach(btn => {
        btn.onclick = function () {
            const idx = parseInt(this.getAttribute('data-idx'));
            const delta = parseInt(this.getAttribute('data-delta'));
            changeQuantitySmooth(idx, delta);
        };
    });
}

function changeQuantitySmooth(idx, delta) {
    if (cart[idx]) {
        cart[idx].quantity += delta;
        if (cart[idx].quantity <= 0) {
            cart.splice(idx, 1);
            displayCartItems(); // re-render if item removed
            localStorage.setItem('cart', JSON.stringify(cart));
            return;
        }
        // Only update the quantity and price in place
        document.getElementById(`cart-qty-${idx}`).textContent = cart[idx].quantity;
        document.getElementById(`cart-total-${idx}`).textContent = `₹${(cart[idx].price * cart[idx].quantity).toFixed(2)}`;
        // Update total
        let total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        document.getElementById('total').textContent = total.toFixed(2);
        localStorage.setItem('cart', JSON.stringify(cart));
    }
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
    // Check if cart is empty or total is 0
    if (!cart.length || cart.reduce((sum, item) => sum + item.price * item.quantity, 0) === 0) {
        alert('No item selected');
        return;
    }
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

