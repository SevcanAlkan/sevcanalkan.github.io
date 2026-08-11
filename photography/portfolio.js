(function () {
    const header = document.querySelector(".portfolio-header");
    const flickrFeedUrl = "https://api.flickr.com/services/feeds/photoset.gne";
    let feedRequestCount = 0;

    function updateHeader() {
        if (header) {
            header.classList.toggle("is-scrolled", window.scrollY > 24);
        }
    }

    function buildFlickrSize(url, suffix) {
        return url.replace(/_[a-z0-9]+(?=\.[a-z]+(?:\?|$))/i, "_" + suffix);
    }

    function buildPhotoSources(item, fallbackImage) {
        const original = item && item.media && item.media.m ? item.media.m : "";
        const sources = original
            ? [
                  buildFlickrSize(original, "k"),
                  buildFlickrSize(original, "h"),
                  buildFlickrSize(original, "b"),
                  buildFlickrSize(original, "c"),
                  buildFlickrSize(original, "z"),
                  original,
                  fallbackImage
              ]
            : [fallbackImage];

        return sources.filter(function (source, index) {
            return source && sources.indexOf(source) === index;
        });
    }

    function applyImageSources(image, sources) {
        let sourceIndex = 0;

        if (!image || sources.length === 0) {
            return;
        }

        function tryNextSource() {
            sourceIndex += 1;

            if (sourceIndex < sources.length) {
                image.src = sources[sourceIndex];
                return;
            }

            image.removeEventListener("error", tryNextSource);
        }

        image.addEventListener("error", tryNextSource);
        image.src = sources[sourceIndex];
    }

    function loadAlbumFeed(albumId, onSuccess, onFailure) {
        const requestNumber = ++feedRequestCount;
        const callbackName = "portfolioFlickrFeed" + Date.now() + "_" + requestNumber;
        const script = document.createElement("script");
        let finished = false;
        let timeoutId = 0;

        function finish(handler, payload, preserveCallback) {
            if (finished) {
                return;
            }

            finished = true;
            window.clearTimeout(timeoutId);
            script.remove();

            if (preserveCallback) {
                window[callbackName] = function () {};
            } else {
                delete window[callbackName];
            }

            handler(payload);
        }

        window[callbackName] = function (feed) {
            finish(onSuccess, feed, false);
        };

        script.async = true;
        script.src =
            flickrFeedUrl +
            "?nsid=199418410@N04&set=" +
            encodeURIComponent(albumId) +
            "&lang=en-us&format=json&jsoncallback=" +
            encodeURIComponent(callbackName) +
            "&_=" +
            Date.now();
        script.addEventListener("error", function () {
            finish(onFailure, null, true);
        });
        document.body.appendChild(script);

        timeoutId = window.setTimeout(function () {
            finish(onFailure, null, true);
        }, 12000);
    }

    function syncTopicCovers() {
        const panels = document.querySelectorAll(".work-panel[data-flickr-album]");

        panels.forEach(function (panel) {
            const albumId = panel.getAttribute("data-flickr-album");
            const image = panel.querySelector("img");

            if (!albumId || !image) {
                return;
            }

            const fallbackImage = image.getAttribute("src") || "";
            loadAlbumFeed(
                albumId,
                function (feed) {
                    const firstPhoto = feed && Array.isArray(feed.items) ? feed.items[0] : null;

                    if (!firstPhoto) {
                        return;
                    }

                    const title = (firstPhoto.title || "").trim();
                    if (title) {
                        image.alt = title;
                    }

                    image.dataset.liveCover = "true";
                    applyImageSources(image, buildPhotoSources(firstPhoto, fallbackImage));
                },
                function () {}
            );
        });
    }

    function setupTopicRail() {
        const rail = document.querySelector(".topic-rail");

        if (!rail) {
            return;
        }

        const links = Array.from(rail.querySelectorAll("a[href^='#']"));
        const trigger = rail.querySelector(".topic-rail-trigger");
        const track = rail.querySelector(".topic-rail-track");
        const hoverCapable = window.matchMedia("(hover: hover) and (pointer: fine)");
        const topics = links
            .map(function (link) {
                return {
                    link: link,
                    panel: document.getElementById(link.hash.slice(1))
                };
            })
            .filter(function (topic) {
                return topic.panel;
            });
        let updatePending = false;
        let hideTimer = 0;
        let pointerInside = false;

        function setRailVisibility(isVisible) {
            rail.classList.toggle("is-visible", isVisible);

            if (trigger) {
                trigger.setAttribute("aria-expanded", String(isVisible));
                trigger.setAttribute("aria-label", isVisible ? "Hide photography topics" : "Show photography topics");
            }
        }

        function scheduleRailHide(delay) {
            window.clearTimeout(hideTimer);
            hideTimer = window.setTimeout(function () {
                if (!pointerInside && !rail.contains(document.activeElement)) {
                    setRailVisibility(false);
                }
            }, delay);
        }

        function revealRail(delay) {
            setRailVisibility(true);
            scheduleRailHide(delay);
        }

        function updateActiveTopic() {
            const marker = window.innerHeight * 0.48;
            let activeTopic = topics[0];

            topics.forEach(function (topic) {
                if (topic.panel.getBoundingClientRect().top <= marker) {
                    activeTopic = topic;
                }
            });

            topics.forEach(function (topic) {
                if (topic === activeTopic) {
                    topic.link.setAttribute("aria-current", "location");
                } else {
                    topic.link.removeAttribute("aria-current");
                }
            });

            if (track) {
                const scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
                const progress = Math.min(1, Math.max(0, window.scrollY / scrollRange));
                const availableHeight = Math.max(0, rail.clientHeight - 24);
                const trackHeight = track.getBoundingClientRect().height;
                const overflow = Math.max(0, trackHeight - availableHeight);
                const spareSpace = Math.max(0, availableHeight - trackHeight);
                const travel = overflow > 0 ? overflow : Math.min(18, spareSpace);
                const drift = (0.5 - progress) * travel;

                track.style.setProperty("--topic-rail-drift", drift.toFixed(2) + "px");
            }

            updatePending = false;
        }

        function requestTopicUpdate() {
            if (updatePending) {
                return;
            }

            updatePending = true;
            window.requestAnimationFrame(updateActiveTopic);
        }

        function handleTopicScroll() {
            revealRail(1600);
            requestTopicUpdate();
        }

        rail.addEventListener("pointerenter", function () {
            if (!hoverCapable.matches) {
                return;
            }

            pointerInside = true;
            window.clearTimeout(hideTimer);
            setRailVisibility(true);
        });
        rail.addEventListener("pointerleave", function () {
            if (!hoverCapable.matches) {
                return;
            }

            pointerInside = false;
            scheduleRailHide(1100);
        });
        rail.addEventListener("focusin", function () {
            window.clearTimeout(hideTimer);
            setRailVisibility(true);
        });
        rail.addEventListener("focusout", function () {
            scheduleRailHide(1100);
        });

        if (trigger) {
            trigger.addEventListener("click", function () {
                if (!hoverCapable.matches) {
                    setRailVisibility(true);
                    trigger.blur();
                    scheduleRailHide(2600);
                    return;
                }

                const willOpen = !rail.classList.contains("is-visible");
                setRailVisibility(willOpen);

                if (willOpen) {
                    scheduleRailHide(2400);
                }
            });
        }

        links.forEach(function (link) {
            link.addEventListener("pointerup", function () {
                link.blur();
                scheduleRailHide(1600);
            });
        });

        rail.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                setRailVisibility(false);
                trigger?.focus();
            }
        });

        updateActiveTopic();
        window.addEventListener("scroll", handleTopicScroll, { passive: true });
        window.addEventListener("resize", requestTopicUpdate);
    }

    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    syncTopicCovers();
    setupTopicRail();

    const gallery = document.getElementById("seriesGallery");
    const status = document.getElementById("seriesStatus");
    const albumId = document.body.getAttribute("data-flickr-album");

    if (!gallery || !status || !albumId) {
        return;
    }

    const seriesTitle = document.body.getAttribute("data-series-title") || "Photography";
    const albumUrl = document.body.getAttribute("data-album-url") || "https://www.flickr.com/photos/sevcan-alkan/";
    const limit = Number.parseInt(document.body.getAttribute("data-photo-limit") || "24", 10);
    const fallbackImage = document.body.getAttribute("data-cover-image") || "";
    let settled = false;

    function makePhoto(item, index) {
        const figure = document.createElement("figure");
        figure.className = "series-photo";

        const link = document.createElement("a");
        link.href = item.link || albumUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        const title = (item.title || "").trim();
        const alt = title || seriesTitle + " photograph by Sevcan Alkan";
        link.setAttribute("aria-label", "Open " + alt + " on Flickr");

        const image = document.createElement("img");
        image.alt = alt;
        image.decoding = "async";
        image.loading = index < 2 ? "eager" : "lazy";

        applyImageSources(image, buildPhotoSources(item, fallbackImage));
        link.appendChild(image);
        figure.appendChild(link);

        if (title) {
            const caption = document.createElement("figcaption");
            caption.textContent = title;
            figure.appendChild(caption);
        }

        return figure;
    }

    function updateSeriesCover(item) {
        const heroImage = document.querySelector(".series-hero > img");

        if (!heroImage || !item) {
            return;
        }

        const title = (item.title || "").trim();
        if (title) {
            heroImage.alt = title;
        }

        heroImage.dataset.liveCover = "true";
        applyImageSources(heroImage, buildPhotoSources(item, fallbackImage));
    }

    function finishWithFallback(message) {
        if (settled) {
            return;
        }

        settled = true;
        status.hidden = false;
        status.innerHTML =
            message +
            ' <a href="' +
            albumUrl +
            '" target="_blank" rel="noopener noreferrer">View the complete album on Flickr</a>.';
    }

    loadAlbumFeed(
        albumId,
        function (feed) {
            if (settled) {
                return;
            }

            const items = feed && Array.isArray(feed.items) ? feed.items.slice(0, limit) : [];

            if (items.length === 0) {
                finishWithFallback("The live collection is temporarily unavailable.");
                return;
            }

            settled = true;
            updateSeriesCover(items[0]);
            gallery.innerHTML = "";
            items.forEach(function (item, index) {
                gallery.appendChild(makePhoto(item, index));
            });
            status.hidden = true;
        },
        function () {
            finishWithFallback("The live collection is temporarily unavailable.");
        }
    );
})();
