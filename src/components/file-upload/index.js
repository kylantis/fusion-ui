class FileUpload extends BaseComponent {
    tagName() {
        return 'fileUpload';
    }

    #componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/upload.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/upload-core.min.js', '/assets/js/upload.min.js']);
    }

    getComponentId() {
        return this.#componentId;
    }

    onStart() {
        console.log('Uploading file');
    }

    render() {
        const { node } = this;
        const { data } = this;

        const uploadDiv = document.createElement('div');
        uploadDiv.className = 'upload';
        $(uploadDiv).ready(() => {
            const fileList = this.appendNode(uploadDiv, 'div', 'filelists');
            const completeTag = this.appendNode(fileList, 'h5', null);
            completeTag.textContent = 'Completed';
            // eslint-disable-next-line no-unused-vars
            const fileListComp = this.appendNode(fileList, 'ol', 'filelist complete');
            const queuedTag = this.appendNode(fileList, 'h5', null);
            queuedTag.textContent = 'Queued';
            const queuedList = this.appendNode(fileList, 'ol', 'filelist queue');
        });
        node.append(uploadDiv);

        $('.upload').upload({
            action: 'localhost/8080/components/file-upload',
        }).on('start.upload', this.onStart)
            .on('complete.upload', this.onComplete);
    }
}
module.exports = FileUpload;


// Formstone.Ready(function() {
//     $(".upload").upload({
//             maxSize: 1073741824,
//             beforeSend: onBeforeSend
//         }).on("start.upload", onStart)
//         .on("complete.upload", onComplete)
//         .on("filestart.upload", onFileStart)
//         .on("fileprogress.upload", onFileProgress)
//         .on("filecomplete.upload", onFileComplete)
//         .on("fileerror.upload", onFileError)
//         // .on("fileremove.upload", onFileRemove)
//         .on("chunkstart.upload", onChunkStart)
//         .on("chunkprogress.upload", onChunkProgress)
//         .on("chunkcomplete.upload", onChunkComplete)
//         .on("chunkerror.upload", onChunkError)
//         .on("queued.upload", onQueued);

//     $(".filelist.queue").on("click", ".cancel", onCancel);
//     // $(".filelist.queue").on("click", ".remove", onRemove);
//     $(".cancel_all").on("click", onCancelAll);
//     $(".start_all").on("click", onStart);
// });

// function onCancel(e) {
//     console.log("Cancel");
//     var index = $(this).parents("li").data("index");
//     $(this).parents("form").find(".upload").upload("abort", parseInt(index, 10));
// }

// function onCancelAll(e) {
//     console.log("Cancel All");
//     $(this).parents("form").find(".upload").upload("abort");
// }

// // function onRemove(e) {
// //   console.log("Remove");
// //   var index = $(this).parents("li").data("index");
// //   $(this).parents("form").find(".upload").upload("remove", parseInt(index, 10));
// // }

// function onBeforeSend(formData, file) {
//     console.log("Before Send");
//     formData.append("test_field", "test_value");
//     // return (file.name.indexOf(".jpg") < -1) ? false : formData; // cancel all jpgs
//     return formData;
// }

// function onQueued(e, files) {
//     console.log("Queued");
//     var html = '';
//     for (var i = 0; i < files.length; i++) {
//         // html += '<li data-index="' + files[i].index + '"><span class="content"><span class="file">' + files[i].name + '</span><span class="remove">Remove</span><span class="cancel">Cancel</span><span class="progress">Queued</span></span><span class="bar"></span></li>';
//         html += '<li data-index="' + files[i].index + '"><span class="content"><span class="file">' + files[i].name + '</span><span class="cancel">Cancel</span><span class="progress">Queued</span></span><span class="bar"></span></li>';
//     }

//     $(this).parents("form").find(".filelist.queue")
//         .append(html);
// }

// function onStart(e, files) {
//     console.log("Start");
//     $(this).parents("form").find(".filelist.queue")
//         .addClass("started")
//         .find("li")
//         .find(".progress").text("Waiting");
// }

// function onComplete(e) {
//     console.log("Complete");
//     // All done!
// }

// function onFileStart(e, file) {
//     console.log("File Start");
//     $(this).parents("form").find(".filelist.queue")
//         .find("li[data-index=" + file.index + "]")
//         .find(".progress").text("0%");
// }

// function onFileProgress(e, file, percent) {
//     console.log("File Progress");
//     var $file = $(this).parents("form").find(".filelist.queue").find("li[data-index=" + file.index + "]");

//     $file.find(".progress").text(percent + "%")
//     $file.find(".bar").css("width", percent + "%");
// }

// function onFileComplete(e, file, response) {
//     console.log("File Complete");
//     if (response.trim() === "" || response.toLowerCase().indexOf("error") > -1) {
//         $(this).parents("form").find(".filelist.queue")
//             .find("li[data-index=" + file.index + "]").addClass("error")
//             .find(".progress").text(response.trim());
//     } else {
//         var $target = $(this).parents("form").find(".filelist.queue").find("li[data-index=" + file.index + "]");
//         $target.find(".file").text(file.name);
//         $target.find(".progress").remove();
//         $target.find(".cancel").remove();
//         $target.appendTo($(this).parents("form").find(".filelist.complete"));
//     }
// }

// function onFileError(e, file, error) {
//     console.log("File Error");
//     $(this).parents("form").find(".filelist.queue")
//         .find("li[data-index=" + file.index + "]").addClass("error")
//         .find(".progress").text("Error: " + error);
// }

// function onFileRemove(e, file, error) {
//     console.log("File Removed");
//     $(this).parents("form").find(".filelist.queue")
//         .find("li[data-index=" + file.index + "]").addClass("error")
//         .find(".progress").text("Removed");
// }

// function onChunkStart(e, file) {
//     console.log("Chunk Start");
// }

// function onChunkProgress(e, file, percent) {
//     console.log("Chunk Progress");
// }

// function onChunkComplete(e, file, response) {
//     console.log("Chunk Complete");
// }

// function onChunkError(e, file, error) {
//     console.log("Chunk Error");
// }

// function onStart(e) {
//     console.log("Start Upload");
//     $(this).parents("form").find(".upload").upload("start");
// }
