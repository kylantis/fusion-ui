/*
 *  Fusion UI
 *  Copyright (C) 2025 Kylantis, Inc
 *  
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *  
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *  
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

class KylantisSiteLanding extends BaseComponent {

    beforeCompile() {
        this.getInput().contactUrl;
    }

    useBodyIfRoot() {
        return true;
    }

    getBodyClass() {
        return 'is-preload';
    }

    onMount() {
        const { body } = document;

        breakpoints({
            default: ['1681px', null],
            xlarge: ['1281px', '1680px'],
            large: ['981px', '1280px'],
            medium: ['737px', '980px'],
            small: ['481px', '736px'],
            xsmall: ['361px', '480px'],
            xxsmall: [null, '360px']
        });

        this.#setupContactForm();

        document.querySelector('.scrolly')
            .addEventListener('click', ({ target }) => {
                this.#scrollTo(target.getAttribute('href'));
            });

        setTimeout(function () {
            body.classList.remove('is-preload');
        }, 100);

        // IE Fixes
        if (browser.name == 'ie') {
            body.classList.add('is-ie');
        }

        // Mobile detection
        if (browser.mobile) {
            body.classList.add('is-mobile');
        }

        // Polyfill: Object fit.
        if (!browser.canUse('object-fit')) {
            // Image with data-position attributes
            const positionedImages = document.querySelectorAll('.image[data-position]');
            positionedImages.forEach(function (container) {
                const img = container.querySelector('img');

                // Apply img as background
                container.style.backgroundImage = `url("${img.getAttribute('src')}")`;
                container.style.backgroundPosition = container.dataset.position;
                container.style.backgroundSize = 'cover';
                container.style.backgroundRepeat = 'no-repeat';

                // Hide img
                img.style.opacity = '0';
            });

            // Gallery images
            const galleryLinks = document.querySelectorAll('.gallery > a');
            galleryLinks.forEach(function (link) {
                const img = link.querySelector('img');

                // Apply img as background
                link.style.backgroundImage = `url("${img.getAttribute('src')}")`;
                link.style.backgroundPosition = 'center';
                link.style.backgroundSize = 'cover';
                link.style.backgroundRepeat = 'no-repeat';

                // Hide img
                img.style.opacity = '0';
            });
        }


        // Gallery functionality
        const galleries = document.querySelectorAll('.gallery');
        galleries.forEach(function (gallery) {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.tabIndex = '-1';

            const inner = document.createElement('div');
            inner.className = 'inner';

            const modalImg = document.createElement('img');
            modalImg.src = '';

            inner.appendChild(modalImg);
            modal.appendChild(inner);
            gallery.prepend(modal);

            // Handle image load events
            modalImg.addEventListener('load', function () {
                setTimeout(function () {
                    // No longer visible? Bail.
                    if (!modal.classList.contains('visible')) return;

                    // Set loaded
                    modal.classList.add('loaded');
                }, 275);
            });

            // Click events for gallery items
            const galleryLinks = gallery.querySelectorAll('a');
            galleryLinks.forEach(function (link) {
                link.addEventListener('click', function (event) {
                    const href = link.getAttribute('href');

                    // Not an image? Bail.
                    if (!href.match(/\.(jpg|gif|png|mp4)$/)) return;

                    // Prevent default.
                    event.preventDefault();
                    event.stopPropagation();

                    // Locked? Bail.
                    if (modal._locked) return;

                    // Lock.
                    modal._locked = true;

                    // Set src.
                    modalImg.setAttribute('src', href);

                    // Set visible.
                    modal.classList.add('visible');

                    // Focus.
                    modal.focus();

                    // Delay.
                    setTimeout(function () {
                        // Unlock.
                        modal._locked = false;
                    }, 600);
                });
            });

            // Modal click event
            modal.addEventListener('click', function (event) {
                // Locked? Bail.
                if (modal._locked) return;

                // Already hidden? Bail.
                if (!modal.classList.contains('visible')) return;

                // Stop propagation.
                event.stopPropagation();

                // Lock.
                modal._locked = true;

                // Clear visible, loaded.
                modal.classList.remove('loaded');

                // Delay.
                setTimeout(function () {
                    modal.classList.remove('visible');

                    setTimeout(function () {
                        // Clear src.
                        modalImg.setAttribute('src', '');

                        // Unlock.
                        modal._locked = false;

                        // Focus.
                        body.focus();
                    }, 475);
                }, 125);
            });

            // Keyboard events
            modal.addEventListener('keypress', function (event) {
                // Escape? Hide modal.
                if (event.keyCode == 27) {
                    modal.click();
                }
            });

            // Mouse events
            ['mouseup', 'mousedown', 'mousemove'].forEach(function (eventType) {
                modal.addEventListener(eventType, function (event) {
                    // Stop propagation.
                    event.stopPropagation();
                });
            });
        });
    }

    #setupContactForm() {
        const { contactUrl } = this.getInput();
        const form = document.querySelector('#contact_form');

        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            const formData = new FormData(form);

            var name = formData.get('name').at(0);
            var email = formData.get('email').at(0);
            var message = formData.get('message').at(0);

            const queryString = new URLSearchParams({ name, email, message }).toString();

            fetch(`${contactUrl}?${queryString}`, {
                method: 'GET',
            })
                .then(response => {
                    alert(
                        response.ok ?
                            'Your message has been sent successfully'
                            : 'An error ocurred while sending your message'
                    );

                    document.querySelectorAll(
                        '#contact_form [name="name"], #contact_form [name="email"], #contact_form [name="message"]'
                    )
                        .forEach(input => {
                            input.value = '';
                        })
                });
        });
    }

    /**
    * Helper function for smooth scrolling to elements
    * 
    * @param {string|Element} target - CSS selector or DOM element to scroll to
    * @param {Object} options - Configuration options
    * @param {number} [options.duration=1000] - Duration of scroll animation in ms
    * @param {number|function} [options.offset=0] - Distance offset from element
    * @param {string} [options.easing='easeInOutExpo'] - Easing type
    * @param {function} [options.onComplete=null] - Callback after scrolling completes
    * @return {Object} - Object with cancel method to stop animation
    */
    #scrollTo(target, options = {}) {
        // Default options
        const settings = {
            duration: 1000,
            offset: 0,
            easing: 'easeInOutExpo',
            onComplete: null,
            ...options
        };

        // Find target element
        const targetElement = typeof target === 'string'
            ? document.querySelector(target)
            : target;

        // Exit if no target found
        if (!targetElement) {
            console.warn(`ScrollTo: Target "${target}" not found`);
            return { cancel: () => { } };
        }

        // Easing functions
        const easings = {
            linear: t => t,
            easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
            easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
            easeInOutQuart: t => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
            easeInOutQuint: t => t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t,
            easeInOutExpo: t => {
                if (t === 0) return 0;
                if (t === 1) return 1;
                if (t < 0.5) return Math.pow(2, 20 * t - 10) / 2;
                return (2 - Math.pow(2, -20 * t + 10)) / 2;
            }
        };

        // Get element position relative to document
        function getElementPos(element) {
            const rect = element.getBoundingClientRect();
            const scrollPos = window.pageYOffset || document.documentElement.scrollTop;
            return rect.top + scrollPos;
        }

        // Calculate offset based on type
        function getOffset() {
            if (typeof settings.offset === 'function') {
                return settings.offset(targetElement);
            }
            return settings.offset;
        }

        // Animation variables
        const startPos = window.pageYOffset || document.documentElement.scrollTop;
        const targetPos = getElementPos(targetElement) + getOffset();
        const distance = targetPos - startPos;
        const startTime = performance.now();
        let animationFrameId = null;
        let isCancelled = false;

        // Animation function
        function animate(currentTime) {
            if (isCancelled) return;

            const elapsedTime = currentTime - startTime;
            const progress = Math.min(elapsedTime / settings.duration, 1);
            const easingFunc = easings[settings.easing] || easings.linear;
            const easedProgress = easingFunc(progress);

            window.scrollTo({
                top: startPos + distance * easedProgress,
                behavior: 'auto' // Using our own animation, not browser's smooth scroll
            });

            if (progress < 1) {
                animationFrameId = requestAnimationFrame(animate);
            } else if (typeof settings.onComplete === 'function') {
                settings.onComplete();
            }
        }

        // Start animation
        animationFrameId = requestAnimationFrame(animate);

        // Return object with cancel method
        return {
            cancel: function () {
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                    isCancelled = true;
                }
            }
        };
    }
}
module.exports = KylantisSiteLanding;