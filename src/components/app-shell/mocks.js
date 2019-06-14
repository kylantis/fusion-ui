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
            name: 'Chilo',
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
        return Promise.resolve(true);
    }

    newListContext(type, maxResultCount, criteria) {
        console.log(type, maxResultCount, criteria);
    }
}
