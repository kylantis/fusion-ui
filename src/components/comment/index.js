class Comment extends BaseComponent {
    tagName() {
        return 'comment';
    }

    #componentId;

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/comment.min.css', '/assets/css/form.min.css', '/assets/css/button.min.css', '/assets/css/icon.min.css', '/assets/css/custom-comment.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies();
    }

    behaviorNames() {
        return ['addNewComment', 'replyComment', 'deleteComment', 'likeComment'];
    }

    getSubjectInfo() {
        // Get the details of the owner of the feed or commentbox
        const subjectInfo = {
            '@userId': '',
            '@authorName': 'Matthew',
            '@avatarUrl': '/assets/images/nan.jpg',
        };
        return subjectInfo;
    }

    getUserInfo() {
        // Get the details of the user posting comments on the comment box
        const userInfo = {
            '@userId': '',
            '@authorName': 'Mark',
            '@avatarUrl': '/assets/images/nan.jpg',
        };
        return userInfo;
    }

    generateId() {
        return `${this.data['@title']}-${this.getRandomInt()}`;
    }

    setComponentId() {
        if (this.data['@id']) {
            this.componentId = this.data['@id'];
        } else {
            this.componentId = this.generateId();
        }
        return this.componentId;
    }

    invokeBehavior(behavior, el, comment) {
        const parent = $(`#${this.componentId}`);
        const lastDiv = $(parent).children('div').last();
        const commentNode = $(el).parent().closest('[id]')[0];
        const commentDiv = document.createElement('div');
        switch (behavior) {
        case 'addNewComment':
            $(lastDiv).after(this.createPost(this.newComment(comment)));
            break;

        case 'replyComment':
            if (commentNode.parentElement.classList.contains('step')) {
                commentDiv.className = 'comment step';
                commentNode.parentElement.lastElementChild.appendChild(commentDiv);
                commentDiv.append(this.createPost(this.newComment(comment)));
            } else {
                commentDiv.className = 'comment step';
                commentNode.lastElementChild.appendChild(commentDiv);
                commentDiv.append(this.createPost(this.newComment(comment)));
            }
            break;

        case 'deleteComment':
            $(`#${comment.id}`).remove();
            break;
        default:
        }
    }

    addNewComment(el, data) {
        this.invokeBehavior('addNewComment', el, data);
    }

    replyComment(el, data) {
        this.invokeBehavior('replyComment', el, data);
    }

    deleteComment(data) {
        this.invokeBehavior('deleteComment', null, data);
    }

    likeComment() {
    }

    newComment(text) {
        const comment = $(text).val();
        const commentDetail = {
            '@tag': 'comment',
            '@id': this.generateId(),
            '@postedOn': 'a second ago',
            '@authorName': this.getUserInfo()['@authorName'],
            '@avatarUrl': this.getUserInfo()['@avatarUrl'],
            '@commentText': comment,
        };
        return commentDetail;
    }

    getComment(comment, userdata) {
        // Sends details to the server
        console.log(userdata, $(comment).val());
    }

    replyForm(userData) {
        const form = document.createElement('form');
        form.className = 'ui reply appended form';
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'field';
        form.appendChild(fieldDiv);
        const textArea = document.createElement('textarea');
        textArea.textContent = `@${userData} `;
        textArea.className = 'textBox focus';
        textArea.setAttribute('autofocus', 'autofocus');
        fieldDiv.appendChild(textArea);
        const buttonDiv = document.createElement('div');
        form.appendChild(buttonDiv);
        buttonDiv.className = 'ui blue labeled submit icon button';
        const iTag = document.createElement('i');
        iTag.className = 'icon edit';
        buttonDiv.appendChild(iTag);
        const text = 'Add Reply';
        buttonDiv.append(text);
        textArea.focus();
        $(buttonDiv).on('click', () => {
            this.replyComment(form, textArea);
            this.getComment(textArea, userData);
            $(textArea).val('');
            $(form).remove();
        });
        return form;
    }

    commentForm(userData) {
        const form = document.createElement('form');
        form.className = 'ui reply form';
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'field';
        form.appendChild(fieldDiv);
        const textArea = document.createElement('textarea');
        fieldDiv.appendChild(textArea);
        const buttonDiv = document.createElement('div');
        form.appendChild(buttonDiv);
        buttonDiv.className = 'ui blue labeled submit icon button';
        const iTag = document.createElement('i');
        iTag.className = 'icon edit';
        buttonDiv.appendChild(iTag);
        const text = 'Add Comment';
        buttonDiv.append(text);
        $(buttonDiv).on('click', () => {
            this.addNewComment(form, textArea);
            this.getComment(textArea, userData);
            $(textArea).val('');
        });
        return form;
    }

    createPost(element) {
        const commentDiv = document.createElement('div');
        commentDiv.className = 'comment';
        if (!element['@id']) {
            commentDiv.id = this.generateId();
        } else {
            commentDiv.id = element['@id'];
        }
        const avatag = document.createElement('a');
        commentDiv.appendChild(avatag);
        avatag.className = 'avatar';
        const imgDiv = document.createElement('img');
        imgDiv.src = element['@avatarUrl'];
        avatag.appendChild(imgDiv);
        const contentDiv = document.createElement('div');
        commentDiv.appendChild(contentDiv);
        contentDiv.className = 'content';
        const authorTag = document.createElement('a');
        contentDiv.appendChild(authorTag);
        authorTag.className = 'author';
        authorTag.textContent = element['@authorName'];
        const metaDiv = document.createElement('div');
        contentDiv.appendChild(metaDiv);
        metaDiv.className = 'metadata';
        const dateSpan = document.createElement('span');
        metaDiv.appendChild(dateSpan);
        dateSpan.className = 'date';
        dateSpan.textContent = element['@postedOn'];
        const textDiv = document.createElement('div');
        contentDiv.appendChild(textDiv);
        textDiv.className = 'text';
        textDiv.textContent = element['@commentText'];
        const actionDiv = document.createElement('div');
        actionDiv.className = 'actions';
        contentDiv.appendChild(actionDiv);
        const replyTag = document.createElement('a');
        replyTag.className = 'reply';
        actionDiv.appendChild(replyTag);
        replyTag.textContent = 'Reply';
        const editTag = document.createElement('a');
        editTag.className = 'edit';
        actionDiv.appendChild(editTag);
        editTag.textContent = 'Edit';
        const deleteTag = document.createElement('a');
        replyTag.className = 'delete';
        actionDiv.appendChild(deleteTag);
        deleteTag.textContent = 'Delete';
        $(replyTag).on('click', () => {
            $(this.node).find('.appended').remove();
            const subjectProfile = $(authorTag).html();
            contentDiv.appendChild(this.replyForm(subjectProfile));
        });
        $(deleteTag).on('click', () => {
            // this will be replaced with a modal
            // eslint-disable-next-line no-alert
            if (confirm('Are you sure you want to remove?')) {
                this.deleteComment(commentDiv);
            }
        });
        if (element['>']) {
            const commentsTag = document.createElement('div');
            commentsTag.className = 'comments step';
            commentDiv.appendChild(commentsTag);
            element['>'].forEach((el) => {
                commentsTag.appendChild(this.createPost(el));
            });
        }
        return commentDiv;
    }

    render() {
        const { node } = this;
        const uiDiv = document.createElement('div');
        uiDiv.className = 'ui comments';
        uiDiv.id = this.setComponentId();
        if (this.data['@threaded']) {
            uiDiv.classList.add('threaded');
        }
        const titleDiv = document.createElement('h3');
        uiDiv.appendChild(titleDiv);
        titleDiv.className = 'ui dividing header';
        titleDiv.textContent = this.data['@title'];
        this.data['>'].forEach((element) => {
            uiDiv.appendChild(this.createPost(element));
        });
        uiDiv.append(this.commentForm(this.getUserInfo()['@authorName']));

        node.append(uiDiv);
    }
}

module.exports = Comment;
