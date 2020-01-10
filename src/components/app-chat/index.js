class ChatApp extends BaseComponent {
    tagName() {
        return 'chatApp';
    }

    componentId = this.getId();

    getComponentId() {
        return this.componentId;
    }

    getCssDependencies() {
        return (['http://127.0.0.9/panther_cdn/boxicons/css/boxicons_v2.0.4.min.css',
            'http://127.0.0.9/panther_cdn/perfect-scrollbar/perfect-scrollbar_v1.4.0.min.css',
            '/assets/css/bootstrap/bootstrap.min.css', '/assets/css/bootstrap/bootstrap-extended.min.css',
            '/assets/css/bootstrap/colors.min.css', '/assets/css/app-chat.min.css']);
    }

    getJsDependencies() {
        return (['/cdn/jquery-3.4.1.min.js', 'http://127.0.0.9/panther_cdn/perfect-scrollbar/perfect-scrollbar_v1.4.0.min.js',
            'http://127.0.0.9/panther_cdn/bootstrap/bootstrap_util_v4.4.1.min.js',
            'http://127.0.0.9/panther_cdn/popperjs/popper_v1.16.0.min.js',
            'http://127.0.0.9/panther_cdn/bootstrap/bootstrap_dropdown_v4.4.1.min.js']);
    }

    behaviorNames() {
    }

    invokeBehavior(behavior, data) {
    }

    getUserData() {

    }

    chatChannels = ['# Developers', '# Designers'];

    settings = [
        { name: 'Add Tag', icon: 'bx bx-tag mr-50' },
        { name: 'Important Contact', icon: 'bx bx-star mr-50' },
        { name: 'Shared Documents', icon: 'bx bx-image-alt mr-50' },
        { name: 'Deleted Documents', icon: 'bx bx-trash-alt mr-50' },
        { name: 'Blocked Contact', icon: 'bx bx-block mr-50' },
    ]

    render() {
        const { node } = this;
        const { data } = this;

        // const mainParent = document.createElement('ChatApp');
        const chatView = document.createElement('div');
        chatView.className = 'chat-application';
        // mainParent.appendChild(chatView);
        const chatSideView = this.appendNode(chatView, 'div', 'sidebar-left');
        const mainChatView = this.appendNode(chatView, 'div', 'content-right');

        // Sidebar
        const chatSidebar = this.appendNode(chatSideView, 'div', 'sidebar');

        // Profile Sidebar
        const cUserProfile = this.appendNode(chatSidebar, 'div', 'chat-user-profile');
        const profileHeader = this.appendNode(cUserProfile, 'header', 'chat-user-profile-header text-center border-bottom');
        const headerSpan = this.appendNode(profileHeader, 'span', 'chat-profile-close');
        // eslint-disable-next-line no-unused-vars
        const iHeaderSpan = this.appendNode(headerSpan, 'i', 'bx bx-x');
        const headerDiv = this.appendNode(profileHeader, 'div', 'my-2');
        const headerAvatar = this.appendNode(headerDiv, 'div', 'avatar');
        const headerImage = this.appendNode(headerAvatar, 'img', undefined);
        // TODO MAKE DYNAMIC
        headerImage.src = '/assets/images/portrait/small/avatar-s-11.jpg';
        headerImage.alt = 'user_avatar';
        headerImage.height = 100;
        headerImage.width = 100;
        const profileUserName = this.appendNode(headerDiv, 'h5', 'mb-0');
        // TODO  MAKE DYNAMIC
        profileUserName.textContent = 'John Doe';
        // eslint-disable-next-line no-unused-vars
        const profileUserDesc = this.appendNode(headerDiv, 'span', undefined);
        const cUserProfileContent = this.appendNode(cUserProfile, 'div', 'chat-user-profile-content');
        const cUserProfileContentChild = this.appendNode(cUserProfileContent, 'div', 'chat-user-profile-scroll ps ps--active-y');
        const aboutHeading = this.appendNode(cUserProfileContentChild, 'h6', 'text-uppercase mb-1');
        aboutHeading.textContent = 'About';
        const aboutDesc = this.appendNode(cUserProfileContentChild, 'p', 'mb-2');
        // TODO MAKE DYNAMIC
        aboutDesc.textContent = 'It is a long established fact that a reader will be distracted by the readable content.';
        const inforHeader = this.appendNode(cUserProfileContentChild, 'h6', undefined);
        inforHeader.textContent = 'Personal Information';
        const infoUl = this.appendNode(cUserProfileContentChild, 'ul', 'list-unstyled mb-2');
        const infoLiEmail = this.appendNode(infoUl, 'li', 'mb-25');
        // TODO MAKE DYNAMIC
        infoLiEmail.textContent = 'email@gmail.com';
        const infoLiPhone = this.appendNode(infoUl, 'li', undefined);
        infoLiPhone.textContent = '+1(789) 950 -7654';
        const channelHeader = this.appendNode(cUserProfileContentChild, 'h6', 'text-uppercase mb-1');
        channelHeader.textContent = 'CHANNELS';
        const channelUl = this.appendNode(cUserProfileContentChild, 'ul', 'list-unstyled mb-2');
        this.chatChannels.forEach((channel) => {
            const li = document.createElement('li');
            const atag = this.appendNode(li, 'a', undefined);
            atag.textContent = channel;
            // eslint-disable-next-line no-script-url
            atag.href = 'javascript:void(0);';
            channelUl.appendChild(li);
        });
        const settingsHeader = this.appendNode(cUserProfileContentChild, 'h6', 'text-uppercase mb-1');
        settingsHeader.textContent = 'Settings';
        const settingsUl = this.appendNode(cUserProfileContentChild, 'ul', 'list-unstyled');
        this.settings.forEach((setting) => {
            const li = document.createElement('li');
            const aTag = this.appendNode(li, 'a', 'd-flex align-items-center');
            // eslint-disable-next-line no-unused-vars
            const iTag = this.appendNode(aTag, 'i', setting.icon);
            const text = setting.name;
            aTag.append(text);
            settingsUl.appendChild(li);
        });
        const psRailDivX = this.appendNode(cUserProfileContentChild, 'div', 'ps__rail-x');
        psRailDivX.setAttribute('style', 'left: 0px; bottom: -374px;');
        const psRailDivXChild = this.appendNode(psRailDivX, 'div', 'ps__thumb-x');
        psRailDivXChild.setAttribute('tab-index', '0');
        psRailDivXChild.setAttribute('style', 'left: 0px; width: 0px;');
        const psRailDivY = this.appendNode(cUserProfileContentChild, 'div', 'ps__rail-y');
        psRailDivY.setAttribute('style', 'top: 374px; height: 179px; right: 0px;');
        const psRailDivYChild = this.appendNode(psRailDivY, 'div', 'ps__thumb-y');
        psRailDivYChild.setAttribute('tab-index', '0');
        psRailDivYChild.setAttribute('style', 'top: 122px; height: 57px;');

        // Main sidebar
        const chatSidebarCard = this.appendNode(chatSidebar, 'div', 'chat-sidebar card');
        const closeIconSpan = this.appendNode(chatSidebarCard, 'span', 'chat-sidebar-close');
        const closeIconTag = this.appendNode(closeIconSpan, 'i', 'bx bx-x');
        const chatSearch = this.appendNode(chatSidebarCard, 'div', 'chat-sidebar-search');
        const inChatSearch = this.appendNode(chatSearch, 'div', 'd-flex align-items-center');
        const inChatSearchPP = this.appendNode(inChatSearch, 'div', 'chat-sidebar-profile-toggle');
        const inChatAvatar = this.appendNode(inChatSearchPP, 'div', 'avatar');
        const inChatImgTag = this.appendNode(inChatAvatar, 'img', undefined);
        // TODO MAKE DYNAMIC
        inChatImgTag.src = '/assets/images/portrait/small/avatar-s-11.jpg';
        inChatImgTag.alt = 'avatar-image';
        inChatImgTag.height = 36;
        inChatImgTag.width = 36;
        const searchField = this.appendNode(inChatSearch, 'fieldset', 'form-group position-relative has-icon-left mx-75 mb-0');
        const searchFieldInput = this.appendNode(searchField, 'input', 'form-control round');
        searchFieldInput.type = 'text';
        searchFieldInput.id = 'chat-search';
        searchFieldInput.placeholder = 'Search';
        const magLogoPosition = this.appendNode(searchField, 'div', 'form-control-position');
        // eslint-disable-next-line no-unused-vars
        const magLogo = this.appendNode(magLogoPosition, 'i', 'bx bx-search-alt text-dark');
        const chatSidebarCardBody = this.appendNode(chatSidebarCard, 'div', 'chat-sidebar-list-wrapper pt-2 ps ps--active-y');
        const channelHeaderMain = this.appendNode(chatSidebarCardBody, 'h6', 'px-2 pb-25 mb-0');
        channelHeaderMain.textContent = 'CHANNELS';
        // eslint-disable-next-line no-unused-vars
        const channelHeaderMainIcon = this.appendNode(channelHeaderMain, 'i', 'bx bx-plus float-right cursor-pointer');
        const channelUlMain = this.appendNode(chatSidebarCardBody, 'ul', 'chat-sidebar-list');
        this.chatChannels.forEach((channel) => {
            const li = document.createElement('li');
            const atag = this.appendNode(li, 'a', undefined);
            // eslint-disable-next-line no-script-url
            atag.href = 'javascript:void(0);';
            const hText = this.appendNode(li, 'h6', 'mb-0');
            hText.textContent = channel;
            channelUlMain.appendChild(li);
        });
        const chatSidebarChatHead = this.appendNode(chatSidebarCardBody, 'h6', 'px-2 pt-2 pb-25 mb-0');
        chatSidebarChatHead.textContent = 'CHATS';
        node.append(chatView);
    }
}

module.exports = ChatApp;
