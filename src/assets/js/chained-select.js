/* eslint-disable */
; (function ($, window, document, undefined) {
    $.fn.chainedTo = function (parentSelector = "",debugRules = false) {
        var $child = $(this);
        var thisChildId = "#" + $child[0].id;

        function setIdChild($id, childId) {
            if (typeof $id.data('updateChild') === 'undefined') {
                $id.attr('data-update-child', childId);
            } else {
                $id.attr('data-update-child', $id.attr('data-update-child') + ',' + childId);
            }
        };
        function setIdParent($id, parentId) {
            if (typeof $id.data('selectParent') === 'undefined') {
                $id.data('selectParent', new Array(parentId.split(",")));
            } else {
                $id.data('selectParent', $id.data('selectParent').concat(parentId.split(",")));
            }
        };
        function saveIdOldState($id) {
            if (typeof $id.data('old-state') === 'undefined') {
                $id.data('old-state', $id.html());
            }
        };

        function matchRule(str, rules, debugRules = false) {
            if (debugRules) console.log('      Parent values to match: ' + str);
            if (debugRules) console.log("      Rules to match with: " + rules);
            var ruleArr = rules;
            
            for (let i = 0; i < ruleArr.length; i++) {
                let thisRuleText = ruleArr[i].split("*").join(".*").split("+").join("\\+");
                let thisRule = new RegExp(thisRuleText);
                if (debugRules) console.log("      - Checking with RegExp: " + thisRule);

                if (thisRule.test(str)) {
                    if (debugRules) console.log("      # MATCHED on rule: " + thisRule);
                    return true;
                }
            }
            if (debugRules) console.log("      # NO MATCH found");
            return false;
        };
        function updateSelections($id) {
            //restore the original state for this select
            $id.html($id.data('old-state'));
            if ($id.attr('data-debug-rules') == "true") {
                var debugRules = true;
            }
            //get the current value of the parents we want to match, join with '+'
            if (typeof $id.data('selectParent') === 'undefined')
                return true;
            var parentVal = $($id.data('selectParent').join(",")).map(function () {
                return this.value;
            }).get().join("+");
            var newInnerHTML = [];
            //loop through each of the select options and remove where the parent value is not found
            if (debugRules) console.log("==> Evaluating select id: #" +$id.attr('id'));
            $id.children().each(function (k, value) {
                if (debugRules) console.log  (" -> Evaluating select option with text: " + value.innerText.trim());
                if (matchRule(parentVal, value.getAttribute('data-available-with').split(","), debugRules)) {
                    newInnerHTML += (value.outerHTML);
                }
            });
            $id.html(newInnerHTML);


        };


        function ClickTab(e) {
            if (typeof $(e.target).attr('data-update-child') === 'undefined')
                return true;

            //get and split the children. For each of those, update the valid selections.
            for (let i = 0; i < $(e.target).attr('data-update-child').split(",").length; i++) {
                updateSelections($($(e.target).attr('data-update-child').split(",")[i]));
            }
            return false;
        };

        //Save the original state of the select in a datafield
        saveIdOldState($child);
//        console.log($(parentSelector));

        //enabling rules debug if requested
        if (debugRules) $child.attr('data-debug-rules', 'true');

        //configure a change trigger on the parent selector
        $(parentSelector).filter(function () {
            return $(this).data('updateChild') === undefined;
        }).change(ClickTab);

        //add a data record to the parent that links it to the child
        $(parentSelector).each(function (k, v) {
            setIdChild($(v), thisChildId);
//            console.log("parentSelector each value: ", $(v));
        });

        //add a data record to the child that links it to the parent.
        setIdParent($child, parentSelector);

        //update the selections right now.
        updateSelections($child);


        // return jQuery object
        return this;
    };


})(jQuery, window, document);

