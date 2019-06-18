// eslint-disable-next-line no-unused-vars
class Mocks {
    getAvailableCountries() {
        return Promise.resolve({
            'en-US': { name: 'United States' },
            'en-GB': { name: 'United Kingdom' },
        });
    }

    getSearchableList() {
        return Promise.resolve([
            { name: 'applications', listingPageUrl: '/applications-search' },
            { name: 'users', listingPageUrl: '/users-search' },
            { name: 'courses', listingPageUrl: '/course-search' },
        ]);
    }

    getOwnAvatar() {
        return Promise.resolve({
            imageUrl: null,
        });
    }

    getPersonName() {
        return Promise.resolve({
            name: 'Anthony',
        });
    }

    enableActivityStream() {
        return Promise.resolve({});
    }

    disableActivityStream() {
        return Promise.resolve({});
    }

    isActivityStreamEnabled() {
        return Promise.resolve({
            isEnabled: true,
        });
    }

    setActivityStreamTimeline() {
        return Promise.resolve({});
    }

    getActivityStreamTimeline() {
        return Promise.resolve({
            timeline: globals.activityStream.timelines.daily,
        });
    }

    hasListingCursor(cursorMoveType, ctx) {
        console.log(cursorMoveType, ctx);
        return Promise.resolve(this.remainingListingResults > 0);
    }

    newListContext(type, maxResultCount, criteria) {
        console.log(type, maxResultCount, criteria);
        this.remainingListingResults = 3;
        return Promise.resolve({
            contextKey: 'abc',
        });
    }

    nextListingResults(type, contextKey) {
        console.log(type, contextKey);
        this.remainingListingResults -= 1;

        const result = [];

        for (let i = 0; i < 20; i += 1) {
            result.push(this.getRandomEvent());
        }

        return Promise.resolve(result);
    }

    getRandomEvent() {
        return {
            date: new Date(),
            html: '<a href="/users?id=31">John Doe</a> <span class="ce-translate">viewed</span> <span class="ce-translate">the</span> <a href="/course-results?academicSemesterCourseId=4856558697578496"><span class="ce-translate">course_result_sheet</span></a> <span class="ce-translate">for</span> <a href="/courses?departmentLevelId=5739238230327296">BIT 311</a>.',
            subjectImageUrl: `https://picsum.photos/100?random=${Math.random()}`,
        };
    }
}
