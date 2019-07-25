class Comment extends BaseComponent {
    tagName() {
        return 'comment';
    }

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/comment.min.css', '/assets/css/form.min.css', '/assets/css/button.min.css', '/assets/css/icon.min.css', '/assets/css/custom-comment.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies();
    }

    getUserId() {
        // Get the details of the owner of the profile
    }

    getOtherUserId() {
        // Get the details of the person posting comments on the thread
    }

    generateId() {
        return `${this.data['@title']}${this.getRandomInt()}`;
    }
    // .ui.threaded.comments .comment .comments {

    behavior(behavior, el, text) {
        const commentNode = $(el).parent().closest('[id]')[0];
        const lastComment = $(el).prev();
        const commentDiv = document.createElement('div');
        switch (behavior) {
        case 'addNewComment':
            lastComment.append(this.createPost(this.newComment(text)));
            break;

        case 'replyComment':
            if (commentNode.parentElement.classList.contains('step')) {
                commentDiv.className = 'comment step';
                commentNode.parentElement.lastElementChild.appendChild(commentDiv);
                commentDiv.append(this.createPost(this.newComment(text)));
            } else {
                commentDiv.className = 'comment step';
                commentNode.lastElementChild.appendChild(commentDiv);
                commentDiv.append(this.createPost(this.newComment(text)));
            }
            break;

        case 'deleteComment':
            break;

        default:
        }
    }

    newComment(text) {
        const comment = $(text).val();
        const comm = {
            '@tag': 'comment',
            '@id': 200,
            '@postedOn': 'a second ago',
            '@authorName': 'Matthew',
            '@avatarUrl': '/assets/images/nan.jpg',
            '@commentText': comment,
        };
        return comm;
    }

    getComment(comment, userdata) {
        // Sends details to the server
        console.log(userdata, $(comment).val());
    }

    // replyForm(userData) {
    //     const form = document.createElement('form');
    //     form.className = 'ui reply appended form';
    //     const fieldDiv = document.createElement('div');
    //     fieldDiv.className = 'field';
    //     form.appendChild(fieldDiv);
    //     const textArea = document.createElement('textarea');
    //     textArea.textContent = `@${userData} `;
    //     textArea.className = 'textBox focus';
    //     textArea.setAttribute('autofocus', '');
    //     fieldDiv.appendChild(textArea);
    //     BaseComponent.getComponent('button', this.replyButton(), form);
    //     $('.button').on('click', () => {
    //         console.log('replyButtonOne clicked');
    //         this.behavior('replyComment', form, textArea);
    //         this.getComment(textArea, userData);
    //         $(textArea).val('');
    //         $(form).remove();
    //     });
    //     return form;
    // }

    replyForm(userData) {
        const form = document.createElement('form');
        form.className = 'ui reply appended form';
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'field';
        form.appendChild(fieldDiv);
        const textArea = document.createElement('textarea');
        textArea.textContent = `@${userData} `;
        textArea.className = 'textBox focus';
        textArea.setAttribute('autofocus', '');
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
            this.behavior('replyComment', form, textArea);
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
            this.behavior('addNewComment', form, textArea);
            this.getComment(textArea, userData);
            $(textArea).val('');
        });
        return form;
    }

    replyButton() {
        const buttondata = {
            '@id': 'replyButtonOne',
            '@name': 'reply',
            '@value': '',
            '@buttonStyle': 'labeled',
            '@iconName': 'edit',
            '@tabIndex': 0,
            '@buttonText': 'Reply',
            '@color': 'blue',
            '@position': '',
        };
        return buttondata;
    }

    // replyForm() {
    //     const form = document.createElement('form');
    //     form.className = 'ui reply form';
    //     const fieldDiv = document.createElement('div');
    //     fieldDiv.className = 'field';
    //     form.appendChild(fieldDiv);
    //     const textArea = document.createElement('textarea');
    //     fieldDiv.appendChild(textArea);
    //     BaseComponent.getComponent('button', this.replyButton(), form);
    //     return form;
    // }

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
        uiDiv.id = this.data['@id'];
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
        uiDiv.append(this.commentForm());

        node.append(uiDiv);
    }
}

module.exports = Comment;
