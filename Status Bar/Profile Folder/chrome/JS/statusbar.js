(function () {

    console.log("Classic Status Bar: starting");

    function init() {

        if (document.getElementById("classic-statusbar"))
            return;

        const { interfaces: Ci } = Components;

        // =========================
        // Create status bar
        // =========================

        let bar = document.createXULElement("hbox");
        bar.id = "classic-statusbar";

        let text = document.createXULElement("label");
        text.id = "classic-status-text";
        text.value = "Done";

        text.setAttribute("crop", "end");

        let progress = document.createElement("progress");
        progress.id = "classic-status-progress";

        progress.max = 100;
        progress.value = 0;

        let progressPanel = document.createElement("div");
        progressPanel.id = "classic-status-progress-panel";

        progressPanel.style.display = "none";

        progressPanel.appendChild(progress);

        // Lock/security panel
        let lockPanel = document.createElement("div");
        lockPanel.id = "classic-status-lock-panel";
		lockPanel.style.display = "none";

        let lockIcon = document.createElement("img");
        lockIcon.id = "classic-status-lock";
        lockIcon.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='%23158000' d='M4 7V5a4 4 0 1 1 8 0v2h1a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h1zm2 0h4V5a2 2 0 1 0-4 0v2z'/%3E%3C/svg%3E";

        lockPanel.appendChild(lockIcon);

        bar.appendChild(text);
        bar.appendChild(progressPanel);
		bar.appendChild(lockPanel);

        document.documentElement.appendChild(bar);

        // =========================
        // Styling
        // =========================

        let style = document.createElement("style");

        style.textContent = `
        #classic-statusbar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 0 4px;
            height: 22px;
            display: flex;
            align-items: center;
            background: -moz-dialog;
            color: -moz-dialogtext;
            border-top: 1px solid #d4d4d4;
            border-left: 1px solid #d4d4d4;
            border-right: 1px solid #d4d4d4;
            border-bottom: 1px solid #d4d4d4;
            z-index: 999999;
        }

        #classic-status-text {
            flex: 1;
            padding: 0;
            padding-left: 0px;
            margin: auto;
            margin-left: 2px;
            overflow: hidden;
            white-space: nowrap;
            line-height: 18px;
        }

        #classic-status-progress-panel {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 150px;
            border-left: 1px solid #d4d4d4;
            box-shadow: inset 1px 0 ThreeDHighlight;
            padding: 0 4px;
        }

        #classic-status-progress {
            min-width: 100%;
            height: 15px;
        }
		
		#classic-status-lock-panel {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 18px;
			height: 100%;
			border-left: 1px solid #d4d4d4;
			box-shadow: inset 1px 0 ThreeDHighlight;
			padding: 0 2px;
		}

		#classic-status-lock {
			width: 16px;
			height: 16px;
			object-fit: contain;
		}
        browser {
            margin-bottom: 22px !important;
        }
        `;

        document.documentElement.appendChild(style);

        // =========================
        // Status text + fallback tracking
        // =========================

        let lastOwnStatus = "Done";

        function setStatus(message, value) {
            text.value = message;
            lastOwnStatus = message;
            if (value !== null)
                progress.value = value;
        }

        // =========================
        // Mirror Firefox's built-in status panel text (link hover)
        // =========================

        try {
            let statusPanel = document.getElementById("statuspanel");
            let statusLabel = document.getElementById("statuspanel-label");

            if (statusPanel && statusLabel) {
                let updateFromPanel = () => {
                    let type = statusPanel.getAttribute("type");
                    if ((type === "overLink" || type === "status") && statusLabel.value) {
                        text.value = statusLabel.value;
                    } else {
                        text.value = lastOwnStatus;
                    }
                };

                let statusObserver = new MutationObserver(updateFromPanel);
                statusObserver.observe(statusPanel, {
                    attributes: true,
                    attributeFilter: ["type"]
                });
                statusObserver.observe(statusLabel, {
                    attributes: true,
                    attributeFilter: ["value"]
                });

                // Fast-poll fallback in case the observer lags
                let lastType = null;
                setInterval(() => {
                    let type = statusPanel.getAttribute("type");
                    if (type !== lastType) {
                        lastType = type;
                        updateFromPanel();
                    }
                }, 30);

            } else {
                console.log("Classic Status Bar: statuspanel not found, skipping status mirror");
            }
        } catch (e) {
            console.error("Classic Status Bar: status mirror setup failed", e);
        }

        ///
        /// HTTPS LOCK
        ///

        function updateLock(state) {
            const wpl = Ci.nsIWebProgressListener;

            console.log(
                "Security state:",
                state,
                "secure:",
                !!(state & wpl.STATE_IS_SECURE));

            if (state & wpl.STATE_IS_SECURE) {
                    lockPanel.style.display = "";

                try {
                    let secInfo = gBrowser.securityUI.secInfo;
                    let cert = secInfo && secInfo.serverCert;
                    let org = cert && cert.issuerOrganization;

                    lockIcon.setAttribute(
                        "title",
                        org ? `Authenticated by ${org}` : "Secure Connection");

                } catch (e) {
                    lockIcon.setAttribute("title", "Secure Connection");
                }

            } else {
                lockPanel.style.display = "none";
                lockIcon.removeAttribute("title");
            }
        }

        // =========================
        // Loading progress
        // =========================

        let listener = {
            onStateChange(webProgress, request, flags, status) {
                if (flags & Ci.nsIWebProgressListener.STATE_START) {
                    console.log("Loading started");
                    progressPanel.style.display = "";
                    setStatus("Connecting...", 0);
                }
                if (flags & Ci.nsIWebProgressListener.STATE_STOP) {
                    console.log("Loading finished");
                    setStatus("Done", 100);
                    setTimeout(() => {
                        progressPanel.style.display = "none";
                        progress.value = 0;
                    }, 5);
                }
            },
            onProgressChange(webProgress, request, curSelf, maxSelf, curTotal, maxTotal) {
                if (maxTotal > 0) {
                    let percent = Math.round((curTotal / maxTotal) * 100);
                    progress.value = percent;
                }
            },

            onSecurityChange(webProgress, request, state) {
                updateLock(state);
            },

            QueryInterface: ChromeUtils.generateQI(["nsIWebProgressListener", "nsISupportsWeakReference"])
        };
        gBrowser.addProgressListener(listener, Ci.nsIWebProgress.NOTIFY_ALL);
        console.log("Classic Status Bar loaded");

        try {
            updateLock(
                gBrowser.selectedBrowser.webProgress.securityUI.state);
        } catch (e) {}

        gBrowser.tabContainer.addEventListener("TabSelect", () => {
            try {
                updateLock(gBrowser.securityUI.state);
            } catch (e) {}
        });

        window.addEventListener("unload", () => {
            gBrowser.removeProgressListener(listener);
        }, {
            once: true
        });
    }

    if (typeof gBrowser !== "undefined") {
        init();
    } else {
        window.addEventListener("load", init, {
            once: true
        });
    }

})();
